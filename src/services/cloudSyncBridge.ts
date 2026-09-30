import type { Person, Union, TreeData } from '../types/tree';
import {
  patchCloudPerson, patchCloudUnion, deleteCloudPerson, deleteCloudUnion,
  patchCloudTreeMetadata, formatFirestoreError, ConcurrencyConflictError,
} from './firestoreService';
import { useCollabStore } from '../stores/useCollabStore';
import {
  browserStorage, readSyncOutbox, writeSyncOutbox, changedFields,
  applyPendingOperations, TREE_METADATA_FIELDS, type SyncOperation,
} from './syncOutbox';
import { reportLocalSave } from './saveStatus';

const DEBOUNCE_DELAY_MS = 500;
const MAX_RETRY_ATTEMPTS = 5;
type PatchOptions = { baseVersion?: number; isSubcollection?: boolean };

export interface SyncTransport {
  person: typeof patchCloudPerson;
  union: typeof patchCloudUnion;
  deletePerson: typeof deleteCloudPerson;
  deleteUnion: typeof deleteCloudUnion;
  metadata: typeof patchCloudTreeMetadata;
}
const defaultTransport: SyncTransport = {
  person: patchCloudPerson, union: patchCloudUnion,
  deletePerson: deleteCloudPerson, deleteUnion: deleteCloudUnion,
  metadata: patchCloudTreeMetadata,
};

export class CloudSyncBridge {
  private pending = new Map<string, SyncOperation>();
  private trees = new Map<string, TreeData>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private attempts = new Map<string, number>();
  private versions = new Map<string, number | undefined>();
  private activeTreeId: string | undefined;
  private baseVersion: number | undefined;
  private sending: Promise<void> = Promise.resolve();
  private disposed = false;
  private storageProvider: () => Storage | null;
  private transport: SyncTransport;
  private onOnline = () => { void this.flushAll(); };
  private onOffline = () => {
    useCollabStore.getState().setCloudSyncStatus('offline', 'Saved on this device; waiting for a connection.');
  };

  constructor(
    storageProvider: () => Storage | null = browserStorage,
    transport: SyncTransport = defaultTransport,
  ) {
    this.storageProvider = storageProvider;
    this.transport = transport;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onOnline);
      window.addEventListener('offline', this.onOffline);
    }
  }

  /** Stop timers/listeners without discarding durable work. */
  public dispose() {
    this.disposed = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
    }
  }

  public setActiveTree(treeId: string | undefined) { this.activeTreeId = treeId; }
  public setBaseVersion(version: number | undefined, treeId = this.activeTreeId) {
    this.baseVersion = version;
    if (treeId) this.versions.set(treeId, version);
  }
  public getBaseVersion(): number | undefined { return this.baseVersion; }
  public hasPendingPatches(treeId?: string): boolean { return this.getPendingCount(treeId) > 0; }
  public getPendingCount(treeId?: string): number {
    return [...this.pending.values()].filter((op) => !treeId || op.treeId === treeId).length;
  }

  private persist(treeId: string): boolean {
    try {
      const saved = writeSyncOutbox({
        schemaVersion: 1, treeId, tree: this.trees.get(treeId),
        operations: [...this.pending.values()].filter((op) => op.treeId === treeId),
      }, this.storageProvider());
      // Node tests without browser storage intentionally run in memory.
      if (!saved && typeof window === 'undefined') return true;
      return reportLocalSave(saved);
    } catch (err) {
      return reportLocalSave(false, err);
    }
  }

  /** Restore only; transmission waits until auth and tree permissions have loaded. */
  public restore(treeId: string): void {
    const outbox = readSyncOutbox(treeId, this.storageProvider());
    if (!outbox) return;
    if (outbox.tree) this.trees.set(treeId, outbox.tree);
    for (const op of outbox.operations) {
      if (!this.pending.has(op.key)) this.pending.set(op.key, op);
    }
  }

  public reconcile(remote: TreeData): TreeData {
    this.restore(remote.id);
    const local = this.trees.get(remote.id);
    const source = structuredClone(remote);
    // A remote tombstone may have removed the record payload. Keep the durable
    // working copy when replaying a local edit/undo that deliberately restores it.
    for (const op of this.pending.values()) {
      if (op.treeId !== remote.id || op.isDelete || op.kind === 'metadata') continue;
      if (op.kind === 'person' && !source.people[op.recordId] && local?.people[op.recordId]) {
        source.people[op.recordId] = structuredClone(local.people[op.recordId]);
      }
      if (op.kind === 'union' && !source.unions[op.recordId] && local?.unions[op.recordId]) {
        source.unions[op.recordId] = structuredClone(local.unions[op.recordId]);
      }
    }
    for (const op of this.pending.values()) {
      if (op.treeId === remote.id) op.isSubcollection = remote.storageMode === 'subcollections';
    }
    const merged = applyPendingOperations(source, [...this.pending.values()]);
    this.trees.set(remote.id, merged);
    this.setBaseVersion(remote.version, remote.id);
    if (!this.persist(remote.id)) {
      throw new Error('Could not durably reconcile cloud data. Keep this tab open and export a backup.');
    }
    return merged;
  }

  /** Explicit destructive reset; never used when switching trees or going offline. */
  public clear() {
    const ids = new Set([...this.pending.values()].map((op) => op.treeId));
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.pending.clear();
    this.attempts.clear();
    for (const id of ids) this.persist(id);
  }

  private schedule(treeId: string, delay = DEBOUNCE_DELAY_MS) {
    const timer = this.timers.get(treeId);
    if (timer) clearTimeout(timer);
    if (this.disposed) return;
    this.timers.set(treeId, setTimeout(() => {
      this.timers.delete(treeId);
      void this.flushAll(treeId);
    }, delay));
  }

  private enqueue(
    treeId: string, kind: SyncOperation['kind'], recordId: string,
    updates: Record<string, unknown>, removedFields: string[], isDelete: boolean,
    options?: PatchOptions,
  ) {
    const key = `${treeId}:${kind}:${recordId}`;
    const existing = this.pending.get(key);
    const combined = isDelete ? {} : { ...(existing?.updates || {}), ...updates };
    const removed = new Set(isDelete ? [] : existing?.removedFields || []);
    for (const field of removedFields) { delete combined[field]; removed.add(field); }
    for (const field of Object.keys(updates)) removed.delete(field);
    this.pending.set(key, {
      key, treeId, kind, recordId, updates: combined, removedFields: [...removed], isDelete,
      isSubcollection: options?.isSubcollection ?? existing?.isSubcollection ?? false,
      baseVersion: options?.baseVersion ?? this.versions.get(treeId) ?? this.baseVersion,
      timestamp: new Date().toISOString(),
    });
    this.attempts.delete(key);
  }

  private queue(treeId: string, kind: 'person' | 'union', id: string, updates: object, isDelete: boolean, options?: PatchOptions) {
    if (!treeId || !id) return;
    const fields = changedFields({}, updates);
    fields.removedFields.push(...Object.keys(updates).filter((k) => (updates as Record<string, unknown>)[k] === undefined));
    this.enqueue(treeId, kind, id, fields.updates, fields.removedFields, isDelete, options);
    this.persist(treeId);
    useCollabStore.getState().setCloudSyncStatus('saving');
    this.schedule(treeId);
  }

  public queuePersonPatch(treeId: string, id: string, updates: Partial<Person>, options?: PatchOptions) {
    this.queue(treeId, 'person', id, updates, false, options);
  }
  public queueUnionPatch(treeId: string, id: string, updates: Partial<Union>, options?: PatchOptions) {
    this.queue(treeId, 'union', id, updates, false, options);
  }
  public queuePersonDelete(treeId: string, id: string, options?: PatchOptions) {
    this.queue(treeId, 'person', id, {}, true, options);
  }
  public queueUnionDelete(treeId: string, id: string, options?: PatchOptions) {
    this.queue(treeId, 'union', id, {}, true, options);
  }

  /** Atomically persist every mutation, including relationships, undo/redo and metadata. */
  public queueBatchDiff(treeId: string, base: TreeData | null, current: TreeData, options?: PatchOptions): boolean {
    if (!treeId || current.id !== treeId || (base && base.id !== treeId)) return false;
    const opts = { ...options, isSubcollection: options?.isSubcollection ?? current.storageMode === 'subcollections' };
    for (const kind of ['person', 'union'] as const) {
      const before = (kind === 'person' ? base?.people : base?.unions) || {};
      const after = kind === 'person' ? current.people : current.unions;
      for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (!after[id]) this.enqueue(treeId, kind, id, {}, [], true, opts);
        else {
          const fields = changedFields(before[id] || {}, after[id]);
          if (Object.keys(fields.updates).length || fields.removedFields.length) {
            this.enqueue(treeId, kind, id, { ...fields.updates, deleted: false }, fields.removedFields, false, opts);
          }
        }
      }
    }
    const beforeMeta: Record<string, unknown> = {};
    const afterMeta: Record<string, unknown> = {};
    for (const field of TREE_METADATA_FIELDS) {
      beforeMeta[field] = base?.[field]; afterMeta[field] = current[field];
    }
    const meta = changedFields(beforeMeta, afterMeta);
    if (Object.keys(meta.updates).length || meta.removedFields.length) {
      this.enqueue(treeId, 'metadata', 'root', meta.updates, meta.removedFields, false, opts);
    }
    this.trees.set(treeId, structuredClone(current));
    const saved = this.persist(treeId);
    if (this.hasPendingPatches(treeId)) {
      useCollabStore.getState().setCloudSyncStatus('saving');
      this.schedule(treeId);
    }
    return saved;
  }

  private async transmit(op: SyncOperation): Promise<boolean> {
    if (this.pending.get(op.key) !== op) return true;
    const collab = useCollabStore.getState();
    if (typeof window !== 'undefined' && !this.activeTreeId) return false;
    if (this.activeTreeId && (op.treeId !== this.activeTreeId || collab.cloudLoading ||
        !collab.isCloudTree || !['owner', 'editor'].includes(collab.userPermission))) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.onOffline(); return false;
    }
    if (!this.persist(op.treeId)) return false;
    try {
      const options = {
        isSubcollection: op.isSubcollection,
        baseVersion: this.versions.get(op.treeId) ?? op.baseVersion,
        removedFields: op.removedFields, timestamp: op.timestamp,
      };
      let result: { version: number } | void;
      if (op.kind === 'metadata') result = await this.transport.metadata(op.treeId, op.updates, op.removedFields);
      else if (op.kind === 'person') result = op.isDelete
        ? await this.transport.deletePerson(op.treeId, op.recordId, options)
        : await this.transport.person(op.treeId, op.recordId, op.updates, options);
      else result = op.isDelete
        ? await this.transport.deleteUnion(op.treeId, op.recordId, options)
        : await this.transport.union(op.treeId, op.recordId, op.updates, options);
      if (result?.version) this.setBaseVersion(result.version, op.treeId);
      // An ACK for an older request must never erase a newer edit.
      if (this.pending.get(op.key) === op) {
        this.pending.delete(op.key);
        if (!this.persist(op.treeId)) { this.pending.set(op.key, op); return false; }
      }
      this.attempts.delete(op.key);
      return true;
    } catch (err) {
      const attempts = (this.attempts.get(op.key) || 0) + 1;
      this.attempts.set(op.key, attempts);
      const message = formatFirestoreError(err);
      useCollabStore.getState().setCloudSyncStatus(message.toLowerCase().includes('offline') ? 'offline' : 'error', message);
      if (attempts < MAX_RETRY_ATTEMPTS && !(err instanceof ConcurrencyConflictError)) {
        this.schedule(op.treeId, Math.min(1000 * 2 ** (attempts - 1), 15000));
      }
      return false;
    }
  }

  public async sendPersonPatch(key: string): Promise<boolean> { return this.sendKey(key); }
  public async sendUnionPatch(key: string): Promise<boolean> { return this.sendKey(key); }
  private async sendKey(key: string): Promise<boolean> {
    let success = true;
    this.sending = this.sending.then(async () => {
      const op = this.pending.get(key);
      if (op) success = await this.transmit(op);
      this.updateStatus();
    });
    await this.sending;
    return success;
  }

  private updateStatus() {
    const collab = useCollabStore.getState();
    if (!this.hasPendingPatches(this.activeTreeId) && !collab.localSaveError) collab.setCloudSyncStatus('synced');
    else if (this.hasPendingPatches(this.activeTreeId) && collab.cloudSyncStatus === 'synced') collab.setCloudSyncStatus('saving');
  }

  public async flushAll(treeId = this.activeTreeId): Promise<void> {
    if (this.disposed) return;
    this.sending = this.sending.then(async () => {
      const ids = treeId ? [treeId] : [...this.timers.keys()];
      for (const id of ids) {
        const timer = this.timers.get(id);
        if (timer) clearTimeout(timer);
        this.timers.delete(id);
      }
      for (const op of [...this.pending.values()]) {
        if (!treeId || op.treeId === treeId) {
          if (!await this.transmit(op)) break;
        }
      }
      this.updateStatus();
    });
    await this.sending;
  }
}

export const cloudSyncBridge = new CloudSyncBridge();