import type { Person, Union } from '../types/tree';
import {
  patchCloudPerson,
  patchCloudUnion,
  formatFirestoreError,
  ConcurrencyConflictError,
} from './firestoreService';
import { useCollabStore } from '../stores/useCollabStore';

interface PendingPersonPatch {
  treeId: string;
  personId: string;
  updates: Partial<Person>;
  baseVersion?: number;
  attempts: number;
  timer: ReturnType<typeof setTimeout> | null;
  isSubcollection?: boolean;
}

interface PendingUnionPatch {
  treeId: string;
  unionId: string;
  updates: Partial<Union>;
  baseVersion?: number;
  attempts: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const DEBOUNCE_DELAY_MS = 500;
const MAX_RETRY_ATTEMPTS = 5;

export class CloudSyncBridge {
  private pendingPersonPatches = new Map<string, PendingPersonPatch>();
  private pendingUnionPatches = new Map<string, PendingUnionPatch>();
  private baseVersion: number | undefined = undefined;
  private isInitialized = false;

  constructor() {
    this.setupNetworkListeners();
  }

  private setupNetworkListeners() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    window.addEventListener('online', () => {
      if (this.hasPendingPatches()) {
        useCollabStore.getState().setCloudSyncStatus('saving');
        this.flushAll().catch((err) => {
          console.error('Failed to flush patches after reconnecting:', err);
        });
      } else {
        useCollabStore.getState().setCloudSyncStatus('synced');
      }
    });

    window.addEventListener('offline', () => {
      useCollabStore.getState().setCloudSyncStatus('offline', 'Network is offline.');
    });
  }

  public setBaseVersion(version: number | undefined) {
    this.baseVersion = version;
  }

  public getBaseVersion(): number | undefined {
    return this.baseVersion;
  }

  public hasPendingPatches(): boolean {
    return this.pendingPersonPatches.size > 0 || this.pendingUnionPatches.size > 0;
  }

  public getPendingCount(): number {
    return this.pendingPersonPatches.size + this.pendingUnionPatches.size;
  }

  public clear() {
    for (const patch of this.pendingPersonPatches.values()) {
      if (patch.timer) clearTimeout(patch.timer);
    }
    for (const patch of this.pendingUnionPatches.values()) {
      if (patch.timer) clearTimeout(patch.timer);
    }
    this.pendingPersonPatches.clear();
    this.pendingUnionPatches.clear();
  }

  /**
   * Queues a granular person update with debouncing and field coalescing.
   */
  public queuePersonPatch(
    treeId: string,
    personId: string,
    updates: Partial<Person>,
    options?: { baseVersion?: number; isSubcollection?: boolean }
  ) {
    if (!treeId || !personId) return;

    const key = `${treeId}:person:${personId}`;
    const existing = this.pendingPersonPatches.get(key);

    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const mergedUpdates: Partial<Person> = {
      ...(existing?.updates || {}),
      ...updates,
    };

    const resolvedVersion = options?.baseVersion ?? existing?.baseVersion ?? this.baseVersion;
    const isSubcollection = options?.isSubcollection ?? existing?.isSubcollection ?? false;

    useCollabStore.getState().setCloudSyncStatus('saving');

    const timer = setTimeout(async () => {
      await this.sendPersonPatch(key);
    }, DEBOUNCE_DELAY_MS);

    this.pendingPersonPatches.set(key, {
      treeId,
      personId,
      updates: mergedUpdates,
      baseVersion: resolvedVersion,
      attempts: existing?.attempts || 0,
      timer,
      isSubcollection,
    });
  }

  /**
   * Queues a granular union update with debouncing and field coalescing.
   */
  public queueUnionPatch(
    treeId: string,
    unionId: string,
    updates: Partial<Union>,
    options?: { baseVersion?: number }
  ) {
    if (!treeId || !unionId) return;

    const key = `${treeId}:union:${unionId}`;
    const existing = this.pendingUnionPatches.get(key);

    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const mergedUpdates: Partial<Union> = {
      ...(existing?.updates || {}),
      ...updates,
    };

    const resolvedVersion = options?.baseVersion ?? existing?.baseVersion ?? this.baseVersion;

    useCollabStore.getState().setCloudSyncStatus('saving');

    const timer = setTimeout(async () => {
      await this.sendUnionPatch(key);
    }, DEBOUNCE_DELAY_MS);

    this.pendingUnionPatches.set(key, {
      treeId,
      unionId,
      updates: mergedUpdates,
      baseVersion: resolvedVersion,
      attempts: existing?.attempts || 0,
      timer,
    });
  }

  /**
   * Sends the pending person patch to Firestore with error recovery and exponential retry.
   */
  public async sendPersonPatch(key: string): Promise<boolean> {
    const item = this.pendingPersonPatches.get(key);
    if (!item) return true;

    try {
      const result = await patchCloudPerson(
        item.treeId,
        item.personId,
        item.updates,
        {
          baseVersion: item.baseVersion,
          isSubcollection: item.isSubcollection,
        }
      );

      if (result?.version) {
        this.baseVersion = result.version;
      }

      this.pendingPersonPatches.delete(key);

      if (!this.hasPendingPatches()) {
        useCollabStore.getState().setCloudSyncStatus('synced');
      }
      return true;
    } catch (err: any) {
      item.attempts += 1;
      const formatted = formatFirestoreError(err);
      console.error(`Granular person patch failed (attempt ${item.attempts}):`, err);

      const isOffline =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        formatted.includes('offline') ||
        err?.code === 'unavailable';

      if (isOffline) {
        useCollabStore.getState().setCloudSyncStatus('offline', formatted);
      } else {
        useCollabStore.getState().setCloudSyncStatus('error', formatted);
      }

      // Schedule retry with exponential backoff if below max attempts
      if (item.attempts < MAX_RETRY_ATTEMPTS && !(err instanceof ConcurrencyConflictError)) {
        const backoffMs = Math.min(1000 * 2 ** (item.attempts - 1), 15000);
        item.timer = setTimeout(() => {
          this.sendPersonPatch(key);
        }, backoffMs);
      }

      return false;
    }
  }

  /**
   * Sends the pending union patch to Firestore with error recovery and exponential retry.
   */
  public async sendUnionPatch(key: string): Promise<boolean> {
    const item = this.pendingUnionPatches.get(key);
    if (!item) return true;

    try {
      const result = await patchCloudUnion(
        item.treeId,
        item.unionId,
        item.updates,
        {
          baseVersion: item.baseVersion,
        }
      );

      if (result?.version) {
        this.baseVersion = result.version;
      }

      this.pendingUnionPatches.delete(key);

      if (!this.hasPendingPatches()) {
        useCollabStore.getState().setCloudSyncStatus('synced');
      }
      return true;
    } catch (err: any) {
      item.attempts += 1;
      const formatted = formatFirestoreError(err);
      console.error(`Granular union patch failed (attempt ${item.attempts}):`, err);

      const isOffline =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        formatted.includes('offline') ||
        err?.code === 'unavailable';

      if (isOffline) {
        useCollabStore.getState().setCloudSyncStatus('offline', formatted);
      } else {
        useCollabStore.getState().setCloudSyncStatus('error', formatted);
      }

      if (item.attempts < MAX_RETRY_ATTEMPTS && !(err instanceof ConcurrencyConflictError)) {
        const backoffMs = Math.min(1000 * 2 ** (item.attempts - 1), 15000);
        item.timer = setTimeout(() => {
          this.sendUnionPatch(key);
        }, backoffMs);
      }

      return false;
    }
  }

  /**
   * Flushes all currently pending granular patches immediately.
   */
  public async flushAll(): Promise<void> {
    const personKeys = Array.from(this.pendingPersonPatches.keys());
    const unionKeys = Array.from(this.pendingUnionPatches.keys());

    for (const key of personKeys) {
      const item = this.pendingPersonPatches.get(key);
      if (item?.timer) clearTimeout(item.timer);
    }
    for (const key of unionKeys) {
      const item = this.pendingUnionPatches.get(key);
      if (item?.timer) clearTimeout(item.timer);
    }

    const promises = [
      ...personKeys.map((k) => this.sendPersonPatch(k)),
      ...unionKeys.map((k) => this.sendUnionPatch(k)),
    ];

    await Promise.all(promises);
  }
}

export const cloudSyncBridge = new CloudSyncBridge();
