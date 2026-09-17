import type { TreeData, Person, Union, PersonDocument, TreeLink } from '../types/tree';

export interface ConflictRecord {
  path: string[];
  baseValue: any;
  localValue: any;
  remoteValue: any;
  resolvedValue: any;
}

export interface TreeMergeResult {
  merged: TreeData;
  hasConflict: boolean;
  conflicts: ConflictRecord[];
}

export interface PersonMergeResult {
  mergedPerson: Person;
  hasConflict: boolean;
  conflicts: ConflictRecord[];
}

export interface UnionMergeResult {
  mergedUnion: Union;
  hasConflict: boolean;
  conflicts: ConflictRecord[];
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === undefined && b === undefined) return true;
  if (a === null && b === null) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }

  return false;
}

function deepClone<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map((item) => deepClone(item)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    result[k] = deepClone(v);
  }
  return result as T;
}

/**
 * 3-way merge for a single Person entity.
 */
export function threeWayMergePerson(
  base: Person | undefined,
  local: Person | undefined,
  remote: Person | undefined,
  personId: string
): PersonMergeResult {
  const conflicts: ConflictRecord[] = [];

  // Case 1: Added only locally
  if (!base && local && !remote) {
    return { mergedPerson: deepClone(local), hasConflict: false, conflicts };
  }

  // Case 2: Added only remotely
  if (!base && !local && remote) {
    return { mergedPerson: deepClone(remote), hasConflict: false, conflicts };
  }

  // Case 3: Added concurrently by both
  if (!base && local && remote) {
    const syntheticBase: Person = { id: personId, unionIds: [] };
    return threeWayMergePerson(syntheticBase, local, remote, personId);
  }

  if (!base || !local || !remote) {
    const fallback = deepClone(local || remote || base) as Person;
    return { mergedPerson: fallback, hasConflict: false, conflicts };
  }

  const merged: Person = {
    id: personId,
    unionIds: [],
  };

  const allKeys = new Set<keyof Person>([
    ...Object.keys(base) as (keyof Person)[],
    ...Object.keys(local) as (keyof Person)[],
    ...Object.keys(remote) as (keyof Person)[],
  ]);

  for (const key of allKeys) {
    if (key === 'id') continue;

    const bVal = base[key];
    const lVal = local[key];
    const rVal = remote[key];

    // Special handling for unionIds (set union)
    if (key === 'unionIds') {
      const bSet = new Set((bVal as string[]) || []);
      const lArr = (lVal as string[]) || [];
      const rArr = (rVal as string[]) || [];

      // Start with local order, add any new IDs added by remote
      const combined = [...lArr];
      for (const id of rArr) {
        if (!combined.includes(id)) {
          // If remote added it (not in base)
          if (!bSet.has(id)) {
            combined.push(id);
          }
        }
      }
      // If remote removed an ID that was in base and local didn't re-add it
      const finalUnionIds = combined.filter((id) => {
        if (bSet.has(id) && !rArr.includes(id) && bVal && (bVal as string[]).includes(id)) {
          return false;
        }
        return true;
      });

      merged.unionIds = finalUnionIds.length > 0 ? finalUnionIds : lArr;
      continue;
    }

    // Special handling for documents (merge by doc.id)
    if (key === 'documents') {
      const bDocs = (bVal as PersonDocument[]) || [];
      const lDocs = (lVal as PersonDocument[]) || [];
      const rDocs = (rVal as PersonDocument[]) || [];

      const docMap = new Map<string, PersonDocument>();
      for (const doc of bDocs) docMap.set(doc.id, doc);
      for (const doc of rDocs) docMap.set(doc.id, doc);
      for (const doc of lDocs) docMap.set(doc.id, doc);

      // Check deletions
      const bIds = new Set(bDocs.map((d) => d.id));
      const lIds = new Set(lDocs.map((d) => d.id));
      const rIds = new Set(rDocs.map((d) => d.id));

      const mergedDocs: PersonDocument[] = [];
      for (const [id, doc] of docMap.entries()) {
        if (bIds.has(id)) {
          if (!lIds.has(id) && rIds.has(id)) continue; // local deleted
          if (!rIds.has(id) && lIds.has(id)) continue; // remote deleted
        }
        mergedDocs.push(doc);
      }
      merged.documents = mergedDocs.length > 0 ? mergedDocs : undefined;
      continue;
    }

    // Special handling for linkedTrees (merge by treeId)
    if (key === 'linkedTrees') {
      const bLinks = (bVal as TreeLink[]) || [];
      const lLinks = (lVal as TreeLink[]) || [];
      const rLinks = (rVal as TreeLink[]) || [];

      const linkMap = new Map<string, TreeLink>();
      for (const link of bLinks) linkMap.set(link.treeId, link);
      for (const link of rLinks) linkMap.set(link.treeId, link);
      for (const link of lLinks) linkMap.set(link.treeId, link);

      const bIds = new Set(bLinks.map((l) => l.treeId));
      const lIds = new Set(lLinks.map((l) => l.treeId));
      const rIds = new Set(rLinks.map((l) => l.treeId));

      const mergedLinks: TreeLink[] = [];
      for (const [id, link] of linkMap.entries()) {
        if (bIds.has(id)) {
          if (!lIds.has(id) && rIds.has(id)) continue;
          if (!rIds.has(id) && lIds.has(id)) continue;
        }
        mergedLinks.push(link);
      }
      merged.linkedTrees = mergedLinks.length > 0 ? mergedLinks : undefined;
      continue;
    }

    // Standard 3-way merge for primitive fields
    const localChanged = !deepEqual(lVal, bVal);
    const remoteChanged = !deepEqual(rVal, bVal);

    if (localChanged && !remoteChanged) {
      if (lVal !== undefined) (merged as any)[key] = deepClone(lVal);
    } else if (!localChanged && remoteChanged) {
      if (rVal !== undefined) (merged as any)[key] = deepClone(rVal);
    } else if (localChanged && remoteChanged) {
      if (deepEqual(lVal, rVal)) {
        if (lVal !== undefined) (merged as any)[key] = deepClone(lVal);
      } else {
        conflicts.push({
          path: ['people', personId, String(key)],
          baseValue: bVal,
          localValue: lVal,
          remoteValue: rVal,
          resolvedValue: lVal,
        });
        if (lVal !== undefined) (merged as any)[key] = deepClone(lVal);
      }
    } else {
      if (bVal !== undefined) (merged as any)[key] = deepClone(bVal);
    }
  }

  return {
    mergedPerson: merged,
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * 3-way merge for a single Union entity.
 */
export function threeWayMergeUnion(
  base: Union | undefined,
  local: Union | undefined,
  remote: Union | undefined,
  unionId: string
): UnionMergeResult {
  const conflicts: ConflictRecord[] = [];

  if (!base && local && !remote) {
    return { mergedUnion: deepClone(local), hasConflict: false, conflicts };
  }
  if (!base && !local && remote) {
    return { mergedUnion: deepClone(remote), hasConflict: false, conflicts };
  }
  if (!base && local && remote) {
    const syntheticBase: Union = { id: unionId, partnerIds: [], childrenIds: [] };
    return threeWayMergeUnion(syntheticBase, local, remote, unionId);
  }
  if (!base || !local || !remote) {
    const fallback = deepClone(local || remote || base) as Union;
    return { mergedUnion: fallback, hasConflict: false, conflicts };
  }

  const merged: Union = {
    id: unionId,
    partnerIds: [],
    childrenIds: [],
  };

  const allKeys = new Set<keyof Union>([
    ...Object.keys(base) as (keyof Union)[],
    ...Object.keys(local) as (keyof Union)[],
    ...Object.keys(remote) as (keyof Union)[],
  ]);

  for (const key of allKeys) {
    if (key === 'id') continue;

    const bVal = base[key];
    const lVal = local[key];
    const rVal = remote[key];

    if (key === 'childrenIds') {
      const bSet = new Set((bVal as string[]) || []);
      const lArr = (lVal as string[]) || [];
      const rArr = (rVal as string[]) || [];

      const combined = [...lArr];
      for (const id of rArr) {
        if (!combined.includes(id) && !bSet.has(id)) {
          combined.push(id);
        }
      }
      const finalChildrenIds = combined.filter((id) => {
        if (bSet.has(id) && !rArr.includes(id) && bVal && (bVal as string[]).includes(id)) {
          return false;
        }
        return true;
      });
      merged.childrenIds = finalChildrenIds.length > 0 ? finalChildrenIds : lArr;
      continue;
    }

    if (key === 'partnerIds') {
      const bSet = new Set((bVal as string[]) || []);
      const lArr = (lVal as string[]) || [];
      const rArr = (rVal as string[]) || [];

      const combined = [...lArr];
      for (const id of rArr) {
        if (!combined.includes(id) && !bSet.has(id)) {
          combined.push(id);
        }
      }
      merged.partnerIds = combined.length > 0 ? combined : lArr;
      continue;
    }

    const localChanged = !deepEqual(lVal, bVal);
    const remoteChanged = !deepEqual(rVal, bVal);

    if (localChanged && !remoteChanged) {
      if (lVal !== undefined) (merged as any)[key] = deepClone(lVal);
    } else if (!localChanged && remoteChanged) {
      if (rVal !== undefined) (merged as any)[key] = deepClone(rVal);
    } else if (localChanged && remoteChanged) {
      if (deepEqual(lVal, rVal)) {
        if (lVal !== undefined) (merged as any)[key] = deepClone(lVal);
      } else {
        conflicts.push({
          path: ['unions', unionId, String(key)],
          baseValue: bVal,
          localValue: lVal,
          remoteValue: rVal,
          resolvedValue: lVal,
        });
        if (lVal !== undefined) (merged as any)[key] = deepClone(lVal);
      }
    } else {
      if (bVal !== undefined) (merged as any)[key] = deepClone(bVal);
    }
  }

  return {
    mergedUnion: merged,
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * 3-way merge for the complete TreeData structure.
 */
export function threeWayMergeTree(
  base: TreeData,
  local: TreeData,
  remote: TreeData
): TreeMergeResult {
  const allConflicts: ConflictRecord[] = [];

  const merged: TreeData = {
    id: local.id || remote.id || base.id,
    name: local.name,
    createdAt: base.createdAt || local.createdAt || remote.createdAt,
    updatedAt: new Date().toISOString(),
    version: Math.max(local.version || 0, remote.version || 0, base.version || 0) + 1,
    storageMode: local.storageMode || remote.storageMode || base.storageMode,
    people: {},
    unions: {},
  };

  // 1. Root-level metadata fields
  const metaKeys: (keyof TreeData)[] = [
    'name',
    'description',
    'rootPersonId',
    'collapsedPersonIds',
    'googleDriveConfig',
    'layoutOverrides',
    'horizontalOverrides',
  ];

  for (const key of metaKeys) {
    const bVal = base[key];
    const lVal = local[key];
    const rVal = remote[key];

    const localChanged = !deepEqual(lVal, bVal);
    const remoteChanged = !deepEqual(rVal, bVal);

    if (localChanged && !remoteChanged) {
      if (lVal !== undefined) (merged as any)[key] = deepClone(lVal);
    } else if (!localChanged && remoteChanged) {
      if (rVal !== undefined) (merged as any)[key] = deepClone(rVal);
    } else if (localChanged && remoteChanged) {
      if (deepEqual(lVal, rVal)) {
        if (lVal !== undefined) (merged as any)[key] = deepClone(lVal);
      } else {
        allConflicts.push({
          path: [String(key)],
          baseValue: bVal,
          localValue: lVal,
          remoteValue: rVal,
          resolvedValue: lVal,
        });
        if (lVal !== undefined) (merged as any)[key] = deepClone(lVal);
      }
    } else {
      if (bVal !== undefined) (merged as any)[key] = deepClone(bVal);
    }
  }

  // 2. Merge People
  const allPersonIds = new Set<string>([
    ...Object.keys(base.people || {}),
    ...Object.keys(local.people || {}),
    ...Object.keys(remote.people || {}),
  ]);

  for (const pId of allPersonIds) {
    const bPerson = base.people?.[pId];
    const lPerson = local.people?.[pId];
    const rPerson = remote.people?.[pId];

    // Person was deleted locally
    if (bPerson && !lPerson && rPerson) {
      if (deepEqual(bPerson, rPerson)) {
        // Remote didn't change it -> respect local deletion
        continue;
      } else {
        // Remote modified it while local deleted it -> conflict! Keep remote's modified person
        allConflicts.push({
          path: ['people', pId],
          baseValue: bPerson,
          localValue: undefined,
          remoteValue: rPerson,
          resolvedValue: rPerson,
        });
        merged.people[pId] = deepClone(rPerson);
        continue;
      }
    }

    // Person was deleted remotely
    if (bPerson && lPerson && !rPerson) {
      if (deepEqual(bPerson, lPerson)) {
        // Local didn't change it -> respect remote deletion
        continue;
      } else {
        // Local modified it while remote deleted it -> conflict! Keep local's modified person
        allConflicts.push({
          path: ['people', pId],
          baseValue: bPerson,
          localValue: lPerson,
          remoteValue: undefined,
          resolvedValue: lPerson,
        });
        merged.people[pId] = deepClone(lPerson);
        continue;
      }
    }

    const { mergedPerson, hasConflict, conflicts } = threeWayMergePerson(
      bPerson,
      lPerson,
      rPerson,
      pId
    );
    merged.people[pId] = mergedPerson;
    if (hasConflict) {
      allConflicts.push(...conflicts);
    }
  }

  // 3. Merge Unions
  const allUnionIds = new Set<string>([
    ...Object.keys(base.unions || {}),
    ...Object.keys(local.unions || {}),
    ...Object.keys(remote.unions || {}),
  ]);

  for (const uId of allUnionIds) {
    const bUnion = base.unions?.[uId];
    const lUnion = local.unions?.[uId];
    const rUnion = remote.unions?.[uId];

    // Union was deleted locally
    if (bUnion && !lUnion && rUnion) {
      if (deepEqual(bUnion, rUnion)) {
        continue;
      } else {
        allConflicts.push({
          path: ['unions', uId],
          baseValue: bUnion,
          localValue: undefined,
          remoteValue: rUnion,
          resolvedValue: rUnion,
        });
        merged.unions[uId] = deepClone(rUnion);
        continue;
      }
    }

    // Union was deleted remotely
    if (bUnion && lUnion && !rUnion) {
      if (deepEqual(bUnion, lUnion)) {
        continue;
      } else {
        allConflicts.push({
          path: ['unions', uId],
          baseValue: bUnion,
          localValue: lUnion,
          remoteValue: undefined,
          resolvedValue: lUnion,
        });
        merged.unions[uId] = deepClone(lUnion);
        continue;
      }
    }

    const { mergedUnion, hasConflict, conflicts } = threeWayMergeUnion(
      bUnion,
      lUnion,
      rUnion,
      uId
    );
    merged.unions[uId] = mergedUnion;
    if (hasConflict) {
      allConflicts.push(...conflicts);
    }
  }

  return {
    merged,
    hasConflict: allConflicts.length > 0,
    conflicts: allConflicts,
  };
}
