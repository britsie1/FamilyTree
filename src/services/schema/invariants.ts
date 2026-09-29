import type { TreeData } from '../../types/tree';
import type { InvariantViolation } from './types';

/**
 * Parses YYYY-MM-DD, YYYY-MM, or YYYY date strings into year, month, day numeric parts.
 */
function parseDateParts(dateStr?: string | null): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.trim().match(/^(\d{1,4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = match[2] ? parseInt(match[2], 10) : 1;
  const day = match[3] ? parseInt(match[3], 10) : 1;
  if (isNaN(year)) return null;
  return { year, month, day };
}

function compareDates(aStr?: string, bStr?: string): number | null {
  const pA = parseDateParts(aStr);
  const pB = parseDateParts(bStr);
  if (!pA || !pB) return null;

  if (pA.year !== pB.year) return pA.year - pB.year;
  if (pA.month !== pB.month) return pA.month - pB.month;
  return pA.day - pB.day;
}

/**
 * Performs deep semantic invariant verification on a TreeData object without throwing.
 * Returns an array of structured violations.
 */
export function checkInvariants(tree: TreeData): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const people = tree.people || {};
  const unions = tree.unions || {};

  // 1. Identity & Collision Invariants
  const personIdSet = new Set<string>();
  for (const [pKey, person] of Object.entries(people)) {
    if (personIdSet.has(person.id)) {
      violations.push({
        code: 'DUPLICATE_ID',
        severity: 'error',
        message: `Duplicate person ID detected: "${person.id}"`,
        path: ['people', pKey],
        entityId: person.id,
        entityType: 'person',
      });
    }
    personIdSet.add(person.id);

    if (pKey !== person.id) {
      violations.push({
        code: 'INVALID_SCHEMA',
        severity: 'error',
        message: `Person map key "${pKey}" does not match person.id "${person.id}"`,
        path: ['people', pKey],
        entityId: person.id,
        entityType: 'person',
      });
    }
  }

  const unionIdSet = new Set<string>();
  for (const [uKey, union] of Object.entries(unions)) {
    if (unionIdSet.has(union.id)) {
      violations.push({
        code: 'DUPLICATE_ID',
        severity: 'error',
        message: `Duplicate union ID detected: "${union.id}"`,
        path: ['unions', uKey],
        entityId: union.id,
        entityType: 'union',
      });
    }
    unionIdSet.add(union.id);

    if (uKey !== union.id) {
      violations.push({
        code: 'INVALID_SCHEMA',
        severity: 'error',
        message: `Union map key "${uKey}" does not match union.id "${union.id}"`,
        path: ['unions', uKey],
        entityId: union.id,
        entityType: 'union',
      });
    }

    // Check collision between person IDs and union IDs
    if (personIdSet.has(union.id)) {
      violations.push({
        code: 'DUPLICATE_ID',
        severity: 'error',
        message: `ID namespace collision: ID "${union.id}" is used for both a person and a union`,
        path: ['unions', uKey],
        entityId: union.id,
        entityType: 'union',
      });
    }
  }

  // 2. Root Person Check
  if (tree.rootPersonId) {
    if (!people[tree.rootPersonId]) {
      violations.push({
        code: 'ROOT_PERSON_NOT_FOUND',
        severity: 'warning',
        message: `Root person ID "${tree.rootPersonId}" does not exist in people dictionary`,
        path: ['rootPersonId'],
        entityId: tree.rootPersonId,
      });
    }
  }

  // 3. Person Invariants (Relationships, Dates, Cross-tree links)
  for (const person of Object.values(people)) {
    // Check parentUnionId
    if (person.parentUnionId) {
      const parentUnion = unions[person.parentUnionId];
      if (!parentUnion) {
        violations.push({
          code: 'DANGLING_UNION_REF',
          severity: 'error',
          message: `Person "${person.id}" references non-existent parentUnionId "${person.parentUnionId}"`,
          path: ['people', person.id, 'parentUnionId'],
          entityId: person.id,
          entityType: 'person',
        });
      } else {
        if (!parentUnion.childrenIds.includes(person.id)) {
          violations.push({
            code: 'INCONSISTENT_PARENT_LINK',
            severity: 'error',
            message: `Person "${person.id}" specifies parentUnionId "${person.parentUnionId}", but union does not list person in childrenIds`,
            path: ['people', person.id, 'parentUnionId'],
            entityId: person.id,
            entityType: 'person',
          });
        }
      }
    }

    // Check unionIds
    const seenPersonUnions = new Set<string>();
    for (const uId of person.unionIds || []) {
      if (seenPersonUnions.has(uId)) {
        violations.push({
          code: 'DUPLICATE_ID',
          severity: 'warning',
          message: `Person "${person.id}" lists duplicate unionId "${uId}"`,
          path: ['people', person.id, 'unionIds'],
          entityId: person.id,
          entityType: 'person',
        });
      }
      seenPersonUnions.add(uId);

      const union = unions[uId];
      if (!union) {
        violations.push({
          code: 'DANGLING_UNION_REF',
          severity: 'error',
          message: `Person "${person.id}" references non-existent unionId "${uId}"`,
          path: ['people', person.id, 'unionIds'],
          entityId: person.id,
          entityType: 'person',
        });
      } else {
        if (!union.partnerIds.includes(person.id)) {
          violations.push({
            code: 'INCONSISTENT_PARENT_LINK',
            severity: 'error',
            message: `Person "${person.id}" lists union "${uId}", but union partnerIds does not include person`,
            path: ['people', person.id, 'unionIds'],
            entityId: person.id,
            entityType: 'person',
          });
        }
      }
    }

    // Check Date Range (Inter-generational marriages are legal, but birth > death is an error)
    if (person.birthDate && person.deathDate) {
      const cmp = compareDates(person.birthDate, person.deathDate);
      if (cmp !== null && cmp > 0) {
        violations.push({
          code: 'INVALID_DATE_RANGE',
          severity: 'error',
          message: `Person "${person.id}" has birthDate "${person.birthDate}" after deathDate "${person.deathDate}"`,
          path: ['people', person.id, 'deathDate'],
          entityId: person.id,
          entityType: 'person',
          details: { birthDate: person.birthDate, deathDate: person.deathDate },
        });
      }
    }

    // Cross-Tree Links
    if (person.linkedTrees) {
      for (let i = 0; i < person.linkedTrees.length; i++) {
        const link = person.linkedTrees[i];
        if (!link.treeId || typeof link.treeId !== 'string' || link.treeId.trim() === '') {
          violations.push({
            code: 'UNRESOLVABLE_CROSS_TREE_LINK',
            severity: 'error',
            message: `Person "${person.id}" has linkedTree at index ${i} with missing or empty treeId`,
            path: ['people', person.id, 'linkedTrees', String(i)],
            entityId: person.id,
            entityType: 'person',
          });
        }
      }
    }
  }

  // 4. Union Invariants (Partners, Children, Self-parenting, Orphaned Edges)
  for (const union of Object.values(unions)) {
    // Check partners
    const seenPartners = new Set<string>();
    for (const pId of union.partnerIds || []) {
      if (seenPartners.has(pId)) {
        violations.push({
          code: 'DUPLICATE_ID',
          severity: 'warning',
          message: `Union "${union.id}" lists duplicate partnerId "${pId}"`,
          path: ['unions', union.id, 'partnerIds'],
          entityId: union.id,
          entityType: 'union',
        });
      }
      seenPartners.add(pId);

      const p = people[pId];
      if (!p) {
        violations.push({
          code: 'DANGLING_PARTNER_REF',
          severity: 'error',
          message: `Union "${union.id}" references non-existent partner "${pId}"`,
          path: ['unions', union.id, 'partnerIds'],
          entityId: union.id,
          entityType: 'union',
        });
      }
    }

    // Check children
    const seenChildren = new Set<string>();
    for (const cId of union.childrenIds || []) {
      if (seenChildren.has(cId)) {
        violations.push({
          code: 'DUPLICATE_ID',
          severity: 'warning',
          message: `Union "${union.id}" lists duplicate childId "${cId}"`,
          path: ['unions', union.id, 'childrenIds'],
          entityId: union.id,
          entityType: 'union',
        });
      }
      seenChildren.add(cId);

      const child = people[cId];
      if (!child) {
        violations.push({
          code: 'DANGLING_CHILD_REF',
          severity: 'error',
          message: `Union "${union.id}" references non-existent child "${cId}"`,
          path: ['unions', union.id, 'childrenIds'],
          entityId: union.id,
          entityType: 'union',
        });
      } else {
        if (child.parentUnionId !== union.id) {
          violations.push({
            code: 'INCONSISTENT_PARENT_LINK',
            severity: 'error',
            message: `Union "${union.id}" lists child "${cId}", but child parentUnionId is "${child.parentUnionId ?? 'undefined'}"`,
            path: ['unions', union.id, 'childrenIds'],
            entityId: union.id,
            entityType: 'union',
          });
        }
      }

      // Self-parenting check (person is both partner and child of the same union)
      if (union.partnerIds.includes(cId)) {
        violations.push({
          code: 'SELF_PARENTING',
          severity: 'error',
          message: `Self-parenting detected: Person "${cId}" is listed as both partner and child of union "${union.id}"`,
          path: ['unions', union.id],
          entityId: union.id,
          entityType: 'union',
          details: { personId: cId },
        });
      }
    }

    // Orphaned edge check: union with 0 partners and 0 children
    if ((!union.partnerIds || union.partnerIds.length === 0) && (!union.childrenIds || union.childrenIds.length === 0)) {
      violations.push({
        code: 'ORPHANED_EDGE',
        severity: 'warning',
        message: `Union "${union.id}" is an orphaned edge with zero partners and zero children`,
        path: ['unions', union.id],
        entityId: union.id,
        entityType: 'union',
      });
    }
  }

  // 5. Parent Graph Cycle Detection (Acyclicity)
  // Directed Graph: Child -> Parent
  const getParents = (personId: string): string[] => {
    const person = people[personId];
    if (!person || !person.parentUnionId) return [];
    const parentUnion = unions[person.parentUnionId];
    return parentUnion ? parentUnion.partnerIds.filter((pId) => Boolean(people[pId])) : [];
  };

  const visitedGlobal = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];
  const cycleParticipants = new Set<string>();

  function dfsCycle(currId: string): void {
    if (visitedGlobal.has(currId)) return;

    visitedGlobal.add(currId);
    inStack.add(currId);
    stack.push(currId);

    for (const parentId of getParents(currId)) {
      if (inStack.has(parentId)) {
        // Cycle found
        const cycleStartIndex = stack.indexOf(parentId);
        if (cycleStartIndex !== -1) {
          for (let i = cycleStartIndex; i < stack.length; i++) {
            cycleParticipants.add(stack[i]);
          }
        }
      } else if (!visitedGlobal.has(parentId)) {
        dfsCycle(parentId);
      }
    }

    inStack.delete(currId);
    stack.pop();
  }

  for (const personId of Object.keys(people)) {
    if (!visitedGlobal.has(personId)) {
      dfsCycle(personId);
    }
  }

  if (cycleParticipants.size > 0) {
    violations.push({
      code: 'PARENT_CYCLE',
      severity: 'error',
      message: `Parent-graph cycle detected involving participants: ${Array.from(cycleParticipants).join(', ')}`,
      path: ['people'],
      details: { participantIds: Array.from(cycleParticipants) },
    });
  }

  return violations;
}
