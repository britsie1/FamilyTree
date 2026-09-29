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

/**
 * Deterministically merges two versions of a single record (Person or Union)
 * implementing Last-Writer-Wins (LWW) and tombstone resolution.
 *
 * Delete vs. Edit Rule:
 * - A delete wins unless the edit has an updatedAt timestamp strictly newer than the tombstone's deletedAt.
 * - If edit is strictly newer, the record is restored (resurrected) and flagged.
 */
export function mergeRecord<T extends SyncRecordMeta>(
  local: T,
  remote: T,
  recordType: 'person' | 'union' = 'person'
): RecordMergeResult<T> {
  const localIsDel = Boolean(local.deleted);
  const remoteIsDel = Boolean(remote.deleted);

  const localTime = parseTime(local.updatedAt);
  const remoteTime = parseTime(remote.updatedAt);

  const localDelTime = parseTime(local.deletedAt) || localTime;
  const remoteDelTime = parseTime(remote.deletedAt) || remoteTime;

  const localRev = typeof local.rev === 'number' ? local.rev : 0;
  const remoteRev = typeof remote.rev === 'number' ? remote.rev : 0;

  // 1. Both are tombstones
  if (localIsDel && remoteIsDel) {
    const winner: MergeWinner =
      localDelTime > remoteDelTime
        ? 'local'
        : remoteDelTime > localDelTime
        ? 'remote'
        : localRev >= remoteRev
        ? 'local'
        : 'remote';

    const chosen = winner === 'local' ? local : remote;
    const fallback = winner === 'local' ? remote : local;

    return {
      merged: {
        ...fallback,
        ...chosen,
        deleted: true,
        deletedAt: chosen.deletedAt || fallback.deletedAt || new Date().toISOString(),
        rev: Math.max(localRev, remoteRev) + 1,
      },
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
      return {
        merged: {
          ...local,
          ...remote,
          deleted: false,
          deletedAt: undefined,
          rev: Math.max(localRev, remoteRev) + 1,
        },
        wasRestored: true,
        isDeleted: false,
        winner: 'remote',
        notice,
      };
    } else {
      // Deletion wins
      return {
        merged: {
          ...remote,
          ...local,
          deleted: true,
          deletedAt: local.deletedAt || local.updatedAt || new Date().toISOString(),
          rev: Math.max(localRev, remoteRev) + 1,
        },
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
      return {
        merged: {
          ...remote,
          ...local,
          deleted: false,
          deletedAt: undefined,
          rev: Math.max(localRev, remoteRev) + 1,
        },
        wasRestored: true,
        isDeleted: false,
        winner: 'local',
        notice,
      };
    } else {
      // Deletion wins
      return {
        merged: {
          ...local,
          ...remote,
          deleted: true,
          deletedAt: remote.deletedAt || remote.updatedAt || new Date().toISOString(),
          rev: Math.max(localRev, remoteRev) + 1,
        },
        wasRestored: false,
        isDeleted: true,
        winner: 'remote',
      };
    }
  }

  // 4. Both are active: Last-Writer-Wins (LWW)
  if (localTime > remoteTime) {
    return {
      merged: { ...remote, ...local, rev: Math.max(localRev, remoteRev) + 1 },
      wasRestored: false,
      isDeleted: false,
      winner: 'local',
    };
  }

  if (remoteTime > localTime) {
    return {
      merged: { ...local, ...remote, rev: Math.max(localRev, remoteRev) + 1 },
      wasRestored: false,
      isDeleted: false,
      winner: 'remote',
    };
  }

  // Timestamps equal or unavailable -> compare rev
  if (localRev > remoteRev) {
    return {
      merged: { ...remote, ...local, rev: localRev + 1 },
      wasRestored: false,
      isDeleted: false,
      winner: 'local',
    };
  }

  if (remoteRev > localRev) {
    return {
      merged: { ...local, ...remote, rev: remoteRev + 1 },
      wasRestored: false,
      isDeleted: false,
      winner: 'remote',
    };
  }

  // Deterministic tie-breaker
  const localStr = JSON.stringify(local);
  const remoteStr = JSON.stringify(remote);
  if (localStr === remoteStr) {
    return {
      merged: local,
      wasRestored: false,
      isDeleted: false,
      winner: 'equal',
    };
  }

  // Tie-breaker: remote wins deterministically
  return {
    merged: { ...local, ...remote, rev: localRev + 1 },
    wasRestored: false,
    isDeleted: false,
    winner: 'remote',
  };
}

/**
 * Merges two dictionaries of records, separating active records from tombstones.
 */
export function mergeRecordDictionary<T extends SyncRecordMeta>(
  localMap: Record<string, T> = {},
  remoteMap: Record<string, T> = {},
  recordType: 'person' | 'union' = 'person'
): {
  active: Record<string, T>;
  tombstones: Record<string, T>;
  restoredIds: string[];
  notices: string[];
} {
  const allIds = new Set([...Object.keys(localMap), ...Object.keys(remoteMap)]);
  const active: Record<string, T> = {};
  const tombstones: Record<string, T> = {};
  const notices: string[] = [];
  const restoredSet = new Set<string>();

  for (const id of allIds) {
    const inLocal = Boolean(localMap[id]);
    const inRemote = Boolean(remoteMap[id]);

    if (inLocal && !inRemote) {
      const rec = localMap[id];
      if (rec.deleted) {
        tombstones[id] = rec;
      } else {
        active[id] = rec;
      }
    } else if (!inLocal && inRemote) {
      const rec = remoteMap[id];
      if (rec.deleted) {
        tombstones[id] = rec;
      } else {
        active[id] = rec;
      }
    } else {
      // Present in both
      const res = mergeRecord(localMap[id], remoteMap[id], recordType);
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
    restoredIds: Array.from(restoredSet),
    notices,
  };
}

/**
 * Pure, deterministic tree synchronization merge engine with tombstone resolution
 * and post-merge invariant repair.
 */
export function syncMerge(
  localTree: TreeData,
  remoteTree: TreeData,
  _options: SyncMergeOptions = {}
): SyncMergeResult {
  const peopleMerge = mergeRecordDictionary(localTree.people, remoteTree.people, 'person');
  const unionsMerge = mergeRecordDictionary(localTree.unions, remoteTree.unions, 'union');

  const localTreeTime = parseTime(localTree.updatedAt);
  const remoteTreeTime = parseTime(remoteTree.updatedAt);

  // Metadata LWW
  const metaWinner = localTreeTime >= remoteTreeTime ? 'local' : 'remote';
  const primaryTree = metaWinner === 'local' ? localTree : remoteTree;
  const secondaryTree = metaWinner === 'local' ? remoteTree : localTree;

  const now = new Date().toISOString();
  const nextVersion = Math.max(localTree.version || 1, remoteTree.version || 1) + 1;

  const rawMergedTree: TreeData = {
    ...secondaryTree,
    ...primaryTree,
    id: localTree.id || remoteTree.id,
    name: primaryTree.name || secondaryTree.name || 'Untitled Tree',
    description: primaryTree.description ?? secondaryTree.description ?? '',
    rootPersonId: primaryTree.rootPersonId || secondaryTree.rootPersonId,
    collapsedPersonIds: primaryTree.collapsedPersonIds || secondaryTree.collapsedPersonIds || [],
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
  for (const uId of Object.keys(unionsMerge.active)) {
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
    notices: [...peopleMerge.notices, ...unionsMerge.notices],
    restoredPersonIds: peopleMerge.restoredIds,
    restoredUnionIds: unionsMerge.restoredIds,
    repairsApplied: repairResult.report.repaired,
  };
}
