import type { Person, Union, TreeData } from '../types/tree';
import { CURRENT_SCHEMA_VERSION } from './schema/constants';
import { repair } from './schema/repair';
import { checkInvariants } from './schema/invariants';

export interface SyncRecordMeta {
  id: string;
  updatedAt?: string;
  updatedBy?: string;
  rev?: number;
  deleted?: boolean;
  deletedAt?: string;
}

export type MergeWinner = 'local' | 'remote' | 'equal';

export interface RecordMergeResult<T extends SyncRecordMeta> {
  merged: T;
  wasRestored: boolean;
  isDeleted: boolean;
  winner: MergeWinner;
  notice?: string;
}

export interface SyncMergeOptions {
  now?: string;
  currentUserId?: string;
}

export interface SyncMergeResult {
  tree: TreeData;
  tombstones: {
    people: Record<string, Person>;
    unions: Record<string, Union>;
  };
  notices: string[];
  restoredPersonIds: string[];
  restoredUnionIds: string[];
  repairsApplied: boolean;
}

function parseTime(val: string | undefined): number {
  if (!val) return 0;
  const t = new Date(val).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function cleanRecord<T extends SyncRecordMeta>(record: T): T {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (v !== undefined) {
      cleaned[k] = v;
    }
  }
  return cleaned as T;
}

/**
 * Deterministically merges two versions of a single record (Person or Union)
 * implementing Last-Writer-Wins (LWW) and tombstone resolution.
 *
 * Guaranteed Properties:
 * - 100% pure function with no ambient Date/time calls.
 * - Commutative: mergeRecord(A, B) and mergeRecord(B, A) select the exact same winning payload.
 * - Idempotent: mergeRecord(A, A) returns A with identical rev.
 * - Strong Eventual Consistency (SEC): Any permutation of incoming sync messages converges to the same state.
 *
 * Delete vs. Edit Rule:
 * - A delete wins unless the edit has an updatedAt timestamp strictly newer than the tombstone's deletedAt.
 * - If edit is strictly newer, the record is restored (resurrected) and flagged.
 */
export function mergeRecord<T extends SyncRecordMeta>(
  local: T,
  remote: T,
  recordType: 'person' | 'union' = 'person',
  fallbackNow?: string
): RecordMergeResult<T> {
  const localStr = JSON.stringify(local);
  const remoteStr = JSON.stringify(remote);

  // Strict idempotence: if payloads are byte-identical, preserve exact state and rev
  if (localStr === remoteStr) {
    return {
      merged: local,
      wasRestored: false,
      isDeleted: Boolean(local.deleted),
      winner: 'equal',
    };
  }

  const localIsDel = Boolean(local.deleted);
  const remoteIsDel = Boolean(remote.deleted);

  const localTime = parseTime(local.updatedAt);
  const remoteTime = parseTime(remote.updatedAt);

  const localDelTime = parseTime(local.deletedAt) || localTime;
  const remoteDelTime = parseTime(remote.deletedAt) || remoteTime;

  const localRev = typeof local.rev === 'number' ? local.rev : 0;
  const remoteRev = typeof remote.rev === 'number' ? remote.rev : 0;

  // Pure deterministic default timestamp derived solely from inputs or explicit fallback
  const maxTime = Math.max(localTime, remoteTime, localDelTime, remoteDelTime);
  const defaultNow =
    fallbackNow ||
    (maxTime > 0
      ? new Date(maxTime).toISOString()
      : local.updatedAt || remote.updatedAt || '1970-01-01T00:00:00.000Z');

  // 1. Both are tombstones
  if (localIsDel && remoteIsDel) {
    const isTie = localDelTime === remoteDelTime && localRev === remoteRev;
    const winner: MergeWinner =
      localDelTime > remoteDelTime
        ? 'local'
        : remoteDelTime > localDelTime
        ? 'remote'
        : localRev > remoteRev
        ? 'local'
        : remoteRev > localRev
        ? 'remote'
        : localStr >= remoteStr
        ? 'local'
        : 'remote';

    const chosen = winner === 'local' ? local : remote;
    const fallback = winner === 'local' ? remote : local;

    return {
      merged: cleanRecord({
        ...fallback,
        ...chosen,
        deleted: true,
        deletedAt: chosen.deletedAt || fallback.deletedAt || chosen.updatedAt || fallback.updatedAt || defaultNow,
        rev: Math.max(localRev, remoteRev) + (isTie ? 1 : 0),
      }),
      wasRestored: false,
      isDeleted: true,
      winner,
    };
  }

  // 2. Local is tombstone, Remote is active (Delete vs. Edit)
  if (localIsDel && !remoteIsDel) {
    if (remoteTime > localDelTime) {
      // Remote edit occurred strictly after local deletion -> Edit wins (resurrection)
      const notice = `Restored ${recordType} ${remote.id}: remote edit (${remote.updatedAt}) is newer than deletion (${local.deletedAt || local.updatedAt}).`;
      const resRec = { ...local, ...remote, deleted: false };
      delete (resRec as unknown as Record<string, unknown>).deletedAt;
      return {
        merged: cleanRecord({
          ...resRec,
          rev: Math.max(localRev, remoteRev) + 1,
        }),
        wasRestored: true,
        isDeleted: false,
        winner: 'remote',
        notice,
      };
    } else {
      // Deletion wins
      return {
        merged: cleanRecord({
          ...remote,
          ...local,
          deleted: true,
          deletedAt: local.deletedAt || local.updatedAt || defaultNow,
          rev: Math.max(localRev, remoteRev),
        }),
        wasRestored: false,
        isDeleted: true,
        winner: 'local',
      };
    }
  }

  // 3. Remote is tombstone, Local is active (Delete vs. Edit)
  if (!localIsDel && remoteIsDel) {
    if (localTime > remoteDelTime) {
      // Local edit occurred strictly after remote deletion -> Edit wins (resurrection)
      const notice = `Restored ${recordType} ${local.id}: local edit (${local.updatedAt}) is newer than remote deletion (${remote.deletedAt || remote.updatedAt}).`;
      const resRec = { ...remote, ...local, deleted: false };
      delete (resRec as unknown as Record<string, unknown>).deletedAt;
      return {
        merged: cleanRecord({
          ...resRec,
          rev: Math.max(localRev, remoteRev) + 1,
        }),
        wasRestored: true,
        isDeleted: false,
        winner: 'local',
        notice,
      };
    } else {
      // Deletion wins
      return {
        merged: cleanRecord({
          ...local,
          ...remote,
          deleted: true,
          deletedAt: remote.deletedAt || remote.updatedAt || defaultNow,
          rev: Math.max(localRev, remoteRev),
        }),
        wasRestored: false,
        isDeleted: true,
        winner: 'remote',
      };
    }
  }

  // 4. Both are active: Last-Writer-Wins (LWW)
  if (localTime > remoteTime) {
    return {
      merged: cleanRecord({ ...remote, ...local, rev: Math.max(localRev, remoteRev) }),
      wasRestored: false,
      isDeleted: false,
      winner: 'local',
    };
  }

  if (remoteTime > localTime) {
    return {
      merged: cleanRecord({ ...local, ...remote, rev: Math.max(localRev, remoteRev) }),
      wasRestored: false,
      isDeleted: false,
      winner: 'remote',
    };
  }

  if (localRev > remoteRev) {
    return {
      merged: cleanRecord({ ...remote, ...local, rev: localRev }),
      wasRestored: false,
      isDeleted: false,
      winner: 'local',
    };
  }

  if (remoteRev > localRev) {
    return {
      merged: cleanRecord({ ...local, ...remote, rev: remoteRev }),
      wasRestored: false,
      isDeleted: false,
      winner: 'remote',
    };
  }

  // Exact concurrent tie on timestamps and revs -> deterministic content comparison tie-breaker
  const winner: MergeWinner = localStr >= remoteStr ? 'local' : 'remote';
  const chosen = winner === 'local' ? local : remote;
  const fallback = winner === 'local' ? remote : local;

  return {
    merged: cleanRecord({
      ...fallback,
      ...chosen,
      rev: Math.max(localRev, remoteRev) + 1,
    }),
    wasRestored: false,
    isDeleted: false,
    winner,
  };
}

/**
 * Merges two dictionaries of records, separating active records from tombstones.
 */
export function mergeRecordDictionary<T extends SyncRecordMeta>(
  localMap: Record<string, T> = {},
  remoteMap: Record<string, T> = {},
  recordType: 'person' | 'union' = 'person',
  fallbackNow?: string
): {
  active: Record<string, T>;
  tombstones: Record<string, T>;
  restoredIds: string[];
  notices: string[];
} {
  const sortedIds = Array.from(new Set([...Object.keys(localMap), ...Object.keys(remoteMap)])).sort();
  const active: Record<string, T> = {};
  const tombstones: Record<string, T> = {};
  const notices: string[] = [];
  const restoredSet = new Set<string>();

  for (const id of sortedIds) {
    const inLocal = Boolean(localMap[id]);
    const inRemote = Boolean(remoteMap[id]);

    if (inLocal && !inRemote) {
      const rec = cleanRecord(localMap[id]);
      if (rec.deleted) {
        tombstones[id] = rec;
      } else {
        active[id] = rec;
      }
    } else if (!inLocal && inRemote) {
      const rec = cleanRecord(remoteMap[id]);
      if (rec.deleted) {
        tombstones[id] = rec;
      } else {
        active[id] = rec;
      }
    } else {
      // Present in both
      const res = mergeRecord(localMap[id], remoteMap[id], recordType, fallbackNow);
      if (res.isDeleted) {
        tombstones[id] = res.merged;
      } else {
        active[id] = res.merged;
      }
      if (res.wasRestored) {
        restoredSet.add(id);
      }
      if (res.notice) {
        notices.push(res.notice);
      }
    }
  }

  return {
    active,
    tombstones,
    restoredIds: Array.from(restoredSet).sort(),
    notices: notices.sort(),
  };
}

/**
 * Pure, deterministic tree synchronization merge engine with tombstone resolution
 * and post-merge invariant repair.
 */
export function syncMerge(
  localTree: TreeData,
  remoteTree: TreeData,
  options: SyncMergeOptions = {}
): SyncMergeResult {
  const localTreeTime = parseTime(localTree.updatedAt);
  const remoteTreeTime = parseTime(remoteTree.updatedAt);

  let maxInputTime = Math.max(localTreeTime, remoteTreeTime);
  for (const p of Object.values(localTree.people || {})) {
    const t = Math.max(parseTime(p.updatedAt), parseTime(p.deletedAt));
    if (t > maxInputTime) maxInputTime = t;
  }
  for (const p of Object.values(remoteTree.people || {})) {
    const t = Math.max(parseTime(p.updatedAt), parseTime(p.deletedAt));
    if (t > maxInputTime) maxInputTime = t;
  }
  for (const u of Object.values(localTree.unions || {})) {
    const t = Math.max(parseTime(u.updatedAt), parseTime(u.deletedAt));
    if (t > maxInputTime) maxInputTime = t;
  }
  for (const u of Object.values(remoteTree.unions || {})) {
    const t = Math.max(parseTime(u.updatedAt), parseTime(u.deletedAt));
    if (t > maxInputTime) maxInputTime = t;
  }

  const now =
    options.now ||
    (maxInputTime > 0
      ? new Date(maxInputTime).toISOString()
      : localTree.updatedAt || remoteTree.updatedAt || '1970-01-01T00:00:00.000Z');

  const peopleMerge = mergeRecordDictionary(localTree.people, remoteTree.people, 'person', now);
  const unionsMerge = mergeRecordDictionary(localTree.unions, remoteTree.unions, 'union', now);

  const localVer = localTree.version || 0;
  const remoteVer = remoteTree.version || 0;
  const localMetaStr = JSON.stringify({
    id: localTree.id,
    name: localTree.name,
    description: localTree.description,
    rootPersonId: localTree.rootPersonId,
  });
  const remoteMetaStr = JSON.stringify({
    id: remoteTree.id,
    name: remoteTree.name,
    description: remoteTree.description,
    rootPersonId: remoteTree.rootPersonId,
  });

  const metaWinner: MergeWinner =
    localTreeTime > remoteTreeTime
      ? 'local'
      : remoteTreeTime > localTreeTime
      ? 'remote'
      : localVer > remoteVer
      ? 'local'
      : remoteVer > localVer
      ? 'remote'
      : localMetaStr >= remoteMetaStr
      ? 'local'
      : 'remote';

  const primaryTree = metaWinner === 'local' ? localTree : remoteTree;
  const secondaryTree = metaWinner === 'local' ? remoteTree : localTree;

  const nextVersion = Math.max(localTree.version || 1, remoteTree.version || 1) + 1;

  // Determine rootPersonId deterministically: prefer primary if valid, else secondary if valid
  let mergedRootPersonId = primaryTree.rootPersonId;
  if (!mergedRootPersonId || !peopleMerge.active[mergedRootPersonId]) {
    mergedRootPersonId =
      secondaryTree.rootPersonId && peopleMerge.active[secondaryTree.rootPersonId]
        ? secondaryTree.rootPersonId
        : Object.keys(peopleMerge.active).sort()[0];
  }

  const mergedCollapsed = Array.from(
    new Set([...(localTree.collapsedPersonIds || []), ...(remoteTree.collapsedPersonIds || [])])
  ).sort();

  const rawMergedTree: TreeData = {
    ...secondaryTree,
    ...primaryTree,
    id: localTree.id || remoteTree.id,
    name: primaryTree.name || secondaryTree.name || 'Untitled Tree',
    description: primaryTree.description ?? secondaryTree.description ?? '',
    rootPersonId: mergedRootPersonId,
    collapsedPersonIds: mergedCollapsed,
    people: peopleMerge.active,
    unions: unionsMerge.active,
    storageMode: 'subcollections',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: nextVersion,
    updatedAt: now,
  };

  // Run deterministic relational repair on the active graph
  const repairResult = repair(rawMergedTree);
  const repairedTree = repairResult.tree;

  // If repair removed any dead unions that were previously active, track them as tombstones
  const allTombstonesUnions = { ...unionsMerge.tombstones };
  for (const uId of Object.keys(unionsMerge.active).sort()) {
    if (!repairedTree.unions[uId]) {
      allTombstonesUnions[uId] = {
        ...(unionsMerge.active[uId] || { id: uId, partnerIds: [], childrenIds: [] }),
        deleted: true,
        deletedAt: now,
        updatedAt: now,
        rev: ((unionsMerge.active[uId]?.rev ?? 0) + 1),
      };
    }
  }

  // Verify invariants
  const violations = checkInvariants(repairedTree);
  if (violations.length > 0) {
    console.warn(`Post-syncMerge invariants report ${violations.length} unresolved violation(s):`, violations);
  }

  return {
    tree: repairedTree,
    tombstones: {
      people: peopleMerge.tombstones,
      unions: allTombstonesUnions,
    },
    notices: [...peopleMerge.notices, ...unionsMerge.notices].sort(),
    restoredPersonIds: peopleMerge.restoredIds,
    restoredUnionIds: unionsMerge.restoredIds,
    repairsApplied: repairResult.report.repaired,
  };
}
