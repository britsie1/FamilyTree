import type { TreeData } from '../types/tree';

export const SYNC_OUTBOX_PREFIX = 'family_tree_sync_outbox_v1_';
export const TREE_METADATA_FIELDS = [
  'name', 'description', 'rootPersonId', 'collapsedPersonIds',
  'googleDriveConfig', 'layoutOverrides', 'horizontalOverrides',
] as const;

export interface SyncOperation {
  key: string;
  treeId: string;
  kind: 'person' | 'union' | 'metadata';
  recordId: string;
  updates: Record<string, unknown>;
  removedFields: string[];
  isDelete: boolean;
  isSubcollection: boolean;
  baseVersion?: number;
  timestamp: string;
}

export interface SyncOutbox {
  schemaVersion: 1;
  treeId: string;
  tree?: TreeData;
  operations: SyncOperation[];
}

export function browserStorage(): Storage | null {
  // Do not silently substitute volatile memory for durable browser storage.
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function readSyncOutbox(treeId: string, storage = browserStorage()): SyncOutbox | null {
  if (!storage) return null;
  const raw = storage.getItem(SYNC_OUTBOX_PREFIX + treeId);
  if (!raw) return null;
  const data = JSON.parse(raw) as SyncOutbox;
  if (data.schemaVersion !== 1 || data.treeId !== treeId || !Array.isArray(data.operations) ||
      (data.tree && data.tree.id !== treeId) || data.operations.some((op) =>
        op.treeId !== treeId || !['person', 'union', 'metadata'].includes(op.kind) ||
        typeof op.key !== 'string' || typeof op.recordId !== 'string' ||
        op.key !== `${treeId}:${op.kind}:${op.recordId}` ||
        typeof op.timestamp !== 'string' || typeof op.isDelete !== 'boolean' ||
        typeof op.isSubcollection !== 'boolean' ||
        !op.updates || typeof op.updates !== 'object' || Array.isArray(op.updates) ||
        !Array.isArray(op.removedFields) || op.removedFields.some((field) => typeof field !== 'string'))) {
    throw new Error('The saved sync outbox is invalid. Export your tree before clearing browser data.');
  }
  return data;
}

/** A single setItem atomically commits the working copy AND its pending operations. */
export function writeSyncOutbox(outbox: SyncOutbox, storage = browserStorage()): boolean {
  if (!storage) return false;
  storage.setItem(SYNC_OUTBOX_PREFIX + outbox.treeId, JSON.stringify(outbox));
  return true;
}

export function changedFields(base: object, next: object): {
  updates: Record<string, unknown>; removedFields: string[];
} {
  const before = base as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  const removedFields: string[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    if (after[key] === undefined) removedFields.push(key);
    else updates[key] = after[key];
  }
  return { updates, removedFields };
}

/** Only replay unacknowledged fields, never overwrite unrelated remote changes. */
export function applyPendingOperations(remote: TreeData, operations: SyncOperation[]): TreeData {
  const tree = structuredClone(remote);
  for (const op of operations) {
    if (op.treeId !== tree.id) continue;
    if (op.kind === 'metadata') {
      const target = tree as unknown as Record<string, unknown>;
      for (const field of TREE_METADATA_FIELDS) {
        if (field in op.updates) target[field] = structuredClone(op.updates[field]);
        if (op.removedFields.includes(field)) delete target[field];
      }
      continue;
    }
    const records = (op.kind === 'person' ? tree.people : tree.unions) as unknown as Record<string, Record<string, unknown>>;
    if (op.isDelete) {
      delete records[op.recordId];
    } else {
      const record = { ...records[op.recordId], ...structuredClone(op.updates), id: op.recordId, deleted: false };
      for (const field of op.removedFields) delete (record as Record<string, unknown>)[field];
      records[op.recordId] = record;
    }
  }
  return tree;
}