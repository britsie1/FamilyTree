import type { Person, Union, TreeData } from '../types/tree';

export const DEFAULT_TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface TombstoneCompactionResult {
  retainedPeople: Record<string, Person>;
  purgedPeople: Record<string, Person>;
  retainedUnions: Record<string, Union>;
  purgedUnions: Record<string, Union>;
  purgedCount: number;
  retainedCount: number;
  safetyViolationsPrevented: string[];
}

function parseTime(val: string | undefined): number {
  if (!val) return 0;
  const t = new Date(val).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Pure, referentially-safe tombstone compactor.
 * Purges tombstones older than the retention threshold (default 30 days),
 * while strictly guaranteeing that no active record references a purged entity.
 */
export function compactTombstones(
  activeTree: TreeData,
  tombstones: {
    people: Record<string, Person>;
    unions: Record<string, Union>;
  },
  maxAgeMs: number = DEFAULT_TOMBSTONE_RETENTION_MS,
  now: number = Date.now()
): TombstoneCompactionResult {
  const retainedPeople: Record<string, Person> = {};
  const purgedPeople: Record<string, Person> = {};
  const retainedUnions: Record<string, Union> = {};
  const purgedUnions: Record<string, Union> = {};
  const safetyViolationsPrevented: string[] = [];

  // Index active graph references for O(1) safety lookup
  const activeReferencedPersonIds = new Set<string>();
  const activeReferencedUnionIds = new Set<string>();

  for (const person of Object.values(activeTree.people || {})) {
    if (person.parentUnionId) {
      activeReferencedUnionIds.add(person.parentUnionId);
    }
    for (const uId of person.unionIds || []) {
      activeReferencedUnionIds.add(uId);
    }
  }

  for (const union of Object.values(activeTree.unions || {})) {
    for (const pId of union.partnerIds || []) {
      activeReferencedPersonIds.add(pId);
    }
    for (const cId of union.childrenIds || []) {
      activeReferencedPersonIds.add(cId);
    }
  }

  // 1. Compact Person Tombstones
  for (const [pId, person] of Object.entries(tombstones.people || {})) {
    const deletedTime = parseTime(person.deletedAt || person.updatedAt);
    const age = now - deletedTime;

    if (age < maxAgeMs) {
      // Not yet expired
      retainedPeople[pId] = person;
    } else if (activeReferencedPersonIds.has(pId)) {
      // Expired but actively referenced by active union! Must not purge.
      retainedPeople[pId] = person;
      safetyViolationsPrevented.push(
        `Person tombstone "${pId}" is older than ${maxAgeMs}ms but still referenced in active tree unions. Retained for data integrity.`
      );
    } else {
      // Safe to purge
      purgedPeople[pId] = person;
    }
  }

  // 2. Compact Union Tombstones
  for (const [uId, union] of Object.entries(tombstones.unions || {})) {
    const deletedTime = parseTime(union.deletedAt || union.updatedAt);
    const age = now - deletedTime;

    if (age < maxAgeMs) {
      // Not yet expired
      retainedUnions[uId] = union;
    } else if (activeReferencedUnionIds.has(uId)) {
      // Expired but actively referenced by active person! Must not purge.
      retainedUnions[uId] = union;
      safetyViolationsPrevented.push(
        `Union tombstone "${uId}" is older than ${maxAgeMs}ms but still referenced in active tree people. Retained for data integrity.`
      );
    } else {
      // Safe to purge
      purgedUnions[uId] = union;
    }
  }

  const purgedCount = Object.keys(purgedPeople).length + Object.keys(purgedUnions).length;
  const retainedCount = Object.keys(retainedPeople).length + Object.keys(retainedUnions).length;

  return {
    retainedPeople,
    purgedPeople,
    retainedUnions,
    purgedUnions,
    purgedCount,
    retainedCount,
    safetyViolationsPrevented,
  };
}
