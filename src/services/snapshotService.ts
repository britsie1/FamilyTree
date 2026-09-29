import type { TreeData } from '../types/tree';
import { sanitizeTree } from './treeOperations';
import { CURRENT_SCHEMA_VERSION, processTreeIngress } from './schema';

export type SnapshotReason =
  | 'pre-json-import'
  | 'pre-gedcom-import'
  | 'pre-cloud-merge'
  | 'pre-preset-switch'
  | 'pre-tree-clear'
  | 'pre-delete-person'
  | 'pre-restore'
  | 'periodic'
  | 'manual';

export interface TreeSnapshot {
  id: string;
  treeId: string;
  treeName: string;
  createdAt: string; // ISO 8601 string
  timestamp: number; // Date.now() for sorting and retention calculations
  reason: SnapshotReason;
  description?: string;
  treeData: TreeData;
  personCount: number;
  unionCount: number;
  schemaVersion: number;
}

export type SnapshotSummary = Omit<TreeSnapshot, 'treeData'>;

export interface SnapshotRetentionPolicy {
  maxRecentSnapshots: number; // Default: 20
  maxRetentionDays: number; // Default: 14
}

export const DEFAULT_RETENTION_POLICY: SnapshotRetentionPolicy = {
  maxRecentSnapshots: 20,
  maxRetentionDays: 14,
};

const DB_NAME = 'familytree_snapshots_db';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

// In-memory fallback for environments without IndexedDB (e.g. Node.js unit tests)
const inMemoryStore = new Map<string, TreeSnapshot>();

/**
 * Checks whether IndexedDB is available in the current runtime environment.
 */
function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Opens or upgrades the IndexedDB instance for tree snapshots.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error('IndexedDB not available in current environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('treeId', 'treeId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('treeId_timestamp', ['treeId', 'timestamp'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Pure helper function to compute which snapshot IDs should be pruned according to retention policy.
 *
 * Rules:
 * 1. The most recent `maxRecentSnapshots` (default 20) are ALWAYS kept unconditionally.
 * 2. Beyond the most recent 20, snapshots within `maxRetentionDays` (default 14) are compacted
 *    to keep at most 1 snapshot per calendar day (the newest one for that day).
 * 3. Any snapshot older than `maxRetentionDays` is marked for pruning.
 */
export function calculateSnapshotIdsToPrune(
  snapshots: Array<{ id: string; timestamp: number }>,
  now: number = Date.now(),
  policy: SnapshotRetentionPolicy = DEFAULT_RETENTION_POLICY
): string[] {
  if (snapshots.length <= policy.maxRecentSnapshots) {
    return [];
  }

  // Sort descending by timestamp (newest first)
  const sorted = [...snapshots].sort((a, b) => b.timestamp - a.timestamp);

  const pruneIds: string[] = [];
  const daysSeen = new Set<string>();
  const msInDay = 24 * 60 * 60 * 1000;
  const maxRetentionMs = policy.maxRetentionDays * msInDay;

  // Items from index 0 to maxRecentSnapshots - 1 are kept unconditionally
  for (let i = policy.maxRecentSnapshots; i < sorted.length; i++) {
    const item = sorted[i];
    const ageMs = now - item.timestamp;

    // Prune if older than max retention window
    if (ageMs > maxRetentionMs) {
      pruneIds.push(item.id);
      continue;
    }

    // Within maxRetentionDays: keep at most 1 per calendar day
    const dayKey = new Date(item.timestamp).toISOString().split('T')[0];
    if (daysSeen.has(dayKey)) {
      pruneIds.push(item.id);
    } else {
      daysSeen.add(dayKey);
    }
  }

  return pruneIds;
}

/**
 * Creates and stores a snapshot of a family tree.
 */
export async function createSnapshot(
  tree: TreeData,
  reason: SnapshotReason,
  description?: string
): Promise<TreeSnapshot> {
  const sanitizedTree = sanitizeTree(tree);
  const now = Date.now();
  const isoDate = new Date(now).toISOString();
  const id = `snap_${tree.id}_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const personCount = Object.keys(sanitizedTree.people || {}).length;
  const unionCount = Object.keys(sanitizedTree.unions || {}).length;

  const snapshot: TreeSnapshot = {
    id,
    treeId: sanitizedTree.id,
    treeName: sanitizedTree.name || 'Untitled Tree',
    createdAt: isoDate,
    timestamp: now,
    reason,
    description,
    treeData: JSON.parse(JSON.stringify(sanitizedTree)),
    personCount,
    unionCount,
    schemaVersion: sanitizedTree.schemaVersion ?? CURRENT_SCHEMA_VERSION,
  };

  if (!isIndexedDBAvailable()) {
    inMemoryStore.set(id, snapshot);
    await pruneSnapshots(snapshot.treeId);
    return snapshot;
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(snapshot);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Auto-prune based on retention policy
    await pruneSnapshots(snapshot.treeId);
    return snapshot;
  } catch (err) {
    console.warn('[SnapshotService] IndexedDB write failed, falling back to memory store:', err);
    inMemoryStore.set(id, snapshot);
    return snapshot;
  }
}

/**
 * Retrieves the list of snapshot summaries for a tree, ordered descending by timestamp (newest first).
 */
export async function listSnapshots(treeId: string): Promise<SnapshotSummary[]> {
  if (!isIndexedDBAvailable()) {
    const list: SnapshotSummary[] = [];
    for (const snap of inMemoryStore.values()) {
      if (snap.treeId === treeId) {
        const { treeData: _ignored, ...summary } = snap;
        list.push(summary);
      }
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  try {
    const db = await openDatabase();
    return await new Promise<SnapshotSummary[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('treeId');
      const req = index.getAll(IDBKeyRange.only(treeId));

      req.onsuccess = () => {
        const results = (req.result as TreeSnapshot[]).map((snap) => {
          const { treeData: _ignored, ...summary } = snap;
          return summary;
        });
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[SnapshotService] IndexedDB read failed, falling back to memory store:', err);
    const list: SnapshotSummary[] = [];
    for (const snap of inMemoryStore.values()) {
      if (snap.treeId === treeId) {
        const { treeData: _ignored, ...summary } = snap;
        list.push(summary);
      }
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }
}

/**
 * Retrieves a single complete snapshot by its ID (including full treeData).
 */
export async function getSnapshot(id: string): Promise<TreeSnapshot | null> {
  if (!isIndexedDBAvailable()) {
    return inMemoryStore.get(id) || null;
  }

  try {
    const db = await openDatabase();
    return await new Promise<TreeSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[SnapshotService] IndexedDB get failed, falling back to memory store:', err);
    return inMemoryStore.get(id) || null;
  }
}

/**
 * Deletes a snapshot by ID.
 */
export async function deleteSnapshot(id: string): Promise<boolean> {
  inMemoryStore.delete(id);

  if (!isIndexedDBAvailable()) {
    return true;
  }

  try {
    const db = await openDatabase();
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[SnapshotService] IndexedDB delete failed:', err);
    return false;
  }
}

/**
 * Prunes expired or surplus snapshots for a tree according to retention policy.
 * Returns the count of deleted snapshots.
 */
export async function pruneSnapshots(
  treeId: string,
  policy: SnapshotRetentionPolicy = DEFAULT_RETENTION_POLICY
): Promise<number> {
  const summaries = await listSnapshots(treeId);
  const idsToPrune = calculateSnapshotIdsToPrune(summaries, Date.now(), policy);

  if (idsToPrune.length === 0) {
    return 0;
  }

  let deletedCount = 0;
  for (const id of idsToPrune) {
    const ok = await deleteSnapshot(id);
    if (ok) deletedCount++;
  }

  return deletedCount;
}

/**
 * Restores a snapshot.
 *
 * CRITICAL SAFETY GUARANTEE:
 * Before applying the restored tree, a "safety undo" snapshot (`pre-restore`) of the current
 * tree is captured automatically. If the user regrets the restore, the previous state
 * is immediately retrievable from the snapshot history.
 */
export async function restoreSnapshot(
  snapshotId: string,
  currentTree: TreeData
): Promise<{ restoredTree: TreeData; safetySnapshot: TreeSnapshot }> {
  const targetSnapshot = await getSnapshot(snapshotId);
  if (!targetSnapshot) {
    throw new Error(`Snapshot with ID "${snapshotId}" was not found.`);
  }

  // 1. Capture safety undo snapshot of current state
  const safetySnapshot = await createSnapshot(
    currentTree,
    'pre-restore',
    `Automatic safety backup before restoring "${targetSnapshot.treeName}" from ${new Date(targetSnapshot.timestamp).toLocaleString()}`
  );

  // 2. Validate and ingress-process restored tree data
  const ingressResult = processTreeIngress(targetSnapshot.treeData, {
    preserveRawOnError: true,
  });

  return {
    restoredTree: ingressResult.tree,
    safetySnapshot,
  };
}

/**
 * Clears all snapshots for a tree or across the entire database.
 */
export async function clearSnapshots(treeId?: string): Promise<void> {
  if (treeId) {
    const summaries = await listSnapshots(treeId);
    for (const s of summaries) {
      await deleteSnapshot(s.id);
    }
    return;
  }

  inMemoryStore.clear();

  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[SnapshotService] IndexedDB clear failed:', err);
  }
}

/**
 * Reset memory store (specifically useful for isolated unit tests).
 */
export function resetSnapshotMemoryStore(): void {
  inMemoryStore.clear();
}
