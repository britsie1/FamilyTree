import type { TreeData } from '../../types/tree';
import type { RepairReport, RepairChange } from './types';

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
 * Deterministically and safely repairs structural, referential, and chronological
 * anomalies in a TreeData model.
 *
 * Guaranteed Invariants:
 * - NEVER deletes any person from tree.people.
 * - Prunes dangling foreign keys.
 * - Enforces bi-directional relational symmetry.
 * - Breaks pedigree cycles safely.
 * - Prunes dead 0-partner 0-child unions.
 */
export function repair(tree: TreeData): { tree: TreeData; report: RepairReport } {
  const changes: RepairChange[] = [];

  // Deep clone tree structure
  const nextTree: TreeData = {
    ...tree,
    people: { ...tree.people },
    unions: { ...tree.unions },
  };

  // Clone individual records
  for (const [id, p] of Object.entries(nextTree.people)) {
    nextTree.people[id] = { ...p, unionIds: [...(p.unionIds || [])] };
  }
  for (const [id, u] of Object.entries(nextTree.unions)) {
    nextTree.unions[id] = {
      ...u,
      partnerIds: [...(u.partnerIds || [])],
      childrenIds: [...(u.childrenIds || [])],
    };
  }

  // 1. Deduplicate IDs in arrays
  for (const p of Object.values(nextTree.people)) {
    const uniqueUnions = Array.from(new Set(p.unionIds || []));
    if (uniqueUnions.length !== p.unionIds.length) {
      changes.push({
        type: 'CLEANED_UNION_REF',
        description: `Deduplicated unionIds on person "${p.id}"`,
        entityId: p.id,
        path: ['people', p.id, 'unionIds'],
      });
      p.unionIds = uniqueUnions;
    }
  }

  for (const u of Object.values(nextTree.unions)) {
    const uniquePartners = Array.from(new Set(u.partnerIds || []));
    if (uniquePartners.length !== u.partnerIds.length) {
      changes.push({
        type: 'PRUNED_DANGLING_PARTNER',
        description: `Deduplicated partnerIds on union "${u.id}"`,
        entityId: u.id,
        path: ['unions', u.id, 'partnerIds'],
      });
      u.partnerIds = uniquePartners;
    }

    const uniqueChildren = Array.from(new Set(u.childrenIds || []));
    if (uniqueChildren.length !== u.childrenIds.length) {
      changes.push({
        type: 'PRUNED_DANGLING_CHILD',
        description: `Deduplicated childrenIds on union "${u.id}"`,
        entityId: u.id,
        path: ['unions', u.id, 'childrenIds'],
      });
      u.childrenIds = uniqueChildren;
    }
  }

  // 2. Prune dangling partner and child references from unions
  for (const u of Object.values(nextTree.unions)) {
    const validPartners = u.partnerIds.filter((pId) => Boolean(nextTree.people[pId]));
    if (validPartners.length !== u.partnerIds.length) {
      const removed = u.partnerIds.filter((pId) => !nextTree.people[pId]);
      changes.push({
        type: 'PRUNED_DANGLING_PARTNER',
        description: `Pruned non-existent partner references [${removed.join(', ')}] from union "${u.id}"`,
        entityId: u.id,
        path: ['unions', u.id, 'partnerIds'],
      });
      u.partnerIds = validPartners;
    }

    const validChildren = u.childrenIds.filter((cId) => Boolean(nextTree.people[cId]));
    if (validChildren.length !== u.childrenIds.length) {
      const removed = u.childrenIds.filter((cId) => !nextTree.people[cId]);
      changes.push({
        type: 'PRUNED_DANGLING_CHILD',
        description: `Pruned non-existent child references [${removed.join(', ')}] from union "${u.id}"`,
        entityId: u.id,
        path: ['unions', u.id, 'childrenIds'],
      });
      u.childrenIds = validChildren;
    }
  }

  // 3. Prune dangling union references from people
  for (const p of Object.values(nextTree.people)) {
    if (p.parentUnionId && !nextTree.unions[p.parentUnionId]) {
      changes.push({
        type: 'CLEANED_PARENT_UNION',
        description: `Cleared non-existent parentUnionId "${p.parentUnionId}" on person "${p.id}"`,
        entityId: p.id,
        path: ['people', p.id, 'parentUnionId'],
      });
      delete p.parentUnionId;
    }

    const validUnions = p.unionIds.filter((uId) => Boolean(nextTree.unions[uId]));
    if (validUnions.length !== p.unionIds.length) {
      const removed = p.unionIds.filter((uId) => !nextTree.unions[uId]);
      changes.push({
        type: 'CLEANED_UNION_REF',
        description: `Removed non-existent unionIds [${removed.join(', ')}] from person "${p.id}"`,
        entityId: p.id,
        path: ['people', p.id, 'unionIds'],
      });
      p.unionIds = validUnions;
    }
  }

  // 4. Resolve self-parenting (person listed as both partner and child of the same union)
  for (const u of Object.values(nextTree.unions)) {
    const selfParents = u.childrenIds.filter((cId) => u.partnerIds.includes(cId));
    for (const pId of selfParents) {
      changes.push({
        type: 'BROKEN_SELF_PARENTING',
        description: `Removed self-parenting child link for partner "${pId}" in union "${u.id}"`,
        entityId: u.id,
        path: ['unions', u.id, 'childrenIds'],
      });
      u.childrenIds = u.childrenIds.filter((cId) => cId !== pId);
      if (nextTree.people[pId]?.parentUnionId === u.id) {
        delete nextTree.people[pId].parentUnionId;
      }
    }
  }

  // 5. Enforce bi-directional relational symmetry
  // 5a. Ensure partners list the union
  for (const u of Object.values(nextTree.unions)) {
    for (const pId of u.partnerIds) {
      const p = nextTree.people[pId];
      if (p && !p.unionIds.includes(u.id)) {
        changes.push({
          type: 'REPAIRED_RECIPROCAL_LINK',
          description: `Added missing union "${u.id}" to partner "${pId}" unionIds`,
          entityId: pId,
          path: ['people', pId, 'unionIds'],
        });
        p.unionIds.push(u.id);
      }
    }
  }

  // 5b. Ensure person unionIds partners include the person
  for (const p of Object.values(nextTree.people)) {
    for (const uId of p.unionIds) {
      const u = nextTree.unions[uId];
      if (u && !u.partnerIds.includes(p.id)) {
        changes.push({
          type: 'REPAIRED_RECIPROCAL_LINK',
          description: `Added partner "${p.id}" to union "${uId}" partnerIds`,
          entityId: uId,
          path: ['unions', uId, 'partnerIds'],
        });
        u.partnerIds.push(p.id);
      }
    }
  }

  // 5c. Ensure union childrenIds match person parentUnionId
  for (const u of Object.values(nextTree.unions)) {
    for (const cId of [...u.childrenIds]) {
      const child = nextTree.people[cId];
      if (!child) continue;
      if (!child.parentUnionId) {
        changes.push({
          type: 'REPAIRED_RECIPROCAL_LINK',
          description: `Set parentUnionId "${u.id}" on child "${cId}"`,
          entityId: cId,
          path: ['people', cId, 'parentUnionId'],
        });
        child.parentUnionId = u.id;
      } else if (child.parentUnionId !== u.id) {
        // Child already has a different parent union; remove from this union
        changes.push({
          type: 'PRUNED_DANGLING_CHILD',
          description: `Removed child "${cId}" from union "${u.id}" because child points to parentUnionId "${child.parentUnionId}"`,
          entityId: u.id,
          path: ['unions', u.id, 'childrenIds'],
        });
        u.childrenIds = u.childrenIds.filter((id) => id !== cId);
      }
    }
  }

  // 5d. Ensure person parentUnionId includes child in union.childrenIds
  for (const p of Object.values(nextTree.people)) {
    if (p.parentUnionId) {
      const pu = nextTree.unions[p.parentUnionId];
      if (pu && !pu.childrenIds.includes(p.id)) {
        changes.push({
          type: 'REPAIRED_RECIPROCAL_LINK',
          description: `Added child "${p.id}" to union "${pu.id}" childrenIds`,
          entityId: pu.id,
          path: ['unions', pu.id, 'childrenIds'],
        });
        pu.childrenIds.push(p.id);
      }
    }
  }

  // 6. Break Ancestry Cycles
  const getParents = (personId: string): string[] => {
    const person = nextTree.people[personId];
    if (!person || !person.parentUnionId) return [];
    const parentUnion = nextTree.unions[person.parentUnionId];
    return parentUnion ? parentUnion.partnerIds.filter((pId) => Boolean(nextTree.people[pId])) : [];
  };

  const visitedGlobal = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  function dfsBreakCycle(currId: string): void {
    if (visitedGlobal.has(currId)) return;

    visitedGlobal.add(currId);
    inStack.add(currId);
    stack.push(currId);

    for (const parentId of getParents(currId)) {
      if (inStack.has(parentId)) {
        // Cycle detected: currId is ancestor of parentId, but parentId is parent of currId!
        // Break the back-edge by unlinking currId from its parent union
        const currPerson = nextTree.people[currId];
        if (currPerson && currPerson.parentUnionId) {
          const pu = nextTree.unions[currPerson.parentUnionId];
          changes.push({
            type: 'BROKEN_PARENT_CYCLE',
            description: `Broken pedigree cycle between "${currId}" and "${parentId}" by unlinking child "${currId}"`,
            entityId: currId,
            path: ['people', currId, 'parentUnionId'],
          });
          if (pu) {
            pu.childrenIds = pu.childrenIds.filter((id) => id !== currId);
          }
          delete currPerson.parentUnionId;
        }
      } else if (!visitedGlobal.has(parentId)) {
        dfsBreakCycle(parentId);
      }
    }

    inStack.delete(currId);
    stack.pop();
  }

  for (const personId of Object.keys(nextTree.people)) {
    if (!visitedGlobal.has(personId)) {
      dfsBreakCycle(personId);
    }
  }

  // 7. Prune dead orphaned unions (0 partners and 0 children)
  for (const [uId, u] of Object.entries(nextTree.unions)) {
    if ((!u.partnerIds || u.partnerIds.length === 0) && (!u.childrenIds || u.childrenIds.length === 0)) {
      changes.push({
        type: 'CLEANED_EMPTY_UNION',
        description: `Pruned dead union "${uId}" with zero partners and zero children`,
        entityId: uId,
        path: ['unions', uId],
      });
      delete nextTree.unions[uId];
    }
  }

  // 8. Repair Invalid Dates (birth > death)
  for (const p of Object.values(nextTree.people)) {
    if (p.birthDate && p.deathDate) {
      const cmp = compareDates(p.birthDate, p.deathDate);
      if (cmp !== null && cmp > 0) {
        changes.push({
          type: 'REPAIRED_INVALID_DATE',
          description: `Removed contradictory deathDate "${p.deathDate}" that was earlier than birthDate "${p.birthDate}" on person "${p.id}"`,
          entityId: p.id,
          path: ['people', p.id, 'deathDate'],
        });
        delete p.deathDate;
      }
    }
    if (p.isDeceased === false) {
      if (p.deathDate || p.deathPlace) {
        changes.push({
          type: 'REPAIRED_INVALID_DATE',
          description: `Cleared deathDate/deathPlace on living person "${p.id}"`,
          entityId: p.id,
          path: ['people', p.id],
        });
        delete p.deathDate;
        delete p.deathPlace;
      }
    }
  }

  // 9. Root person repair
  if (nextTree.rootPersonId && !nextTree.people[nextTree.rootPersonId]) {
    const fallbackId = Object.keys(nextTree.people)[0] || undefined;
    changes.push({
      type: 'REPAIRED_ROOT_PERSON',
      description: `Re-pointed invalid rootPersonId "${nextTree.rootPersonId}" to "${fallbackId || 'none'}"`,
      entityId: nextTree.rootPersonId,
      path: ['rootPersonId'],
    });
    nextTree.rootPersonId = fallbackId;
  }

  // 10. Clean collapsedPersonIds
  if (nextTree.collapsedPersonIds) {
    nextTree.collapsedPersonIds = nextTree.collapsedPersonIds.filter((id) => Boolean(nextTree.people[id]));
  }

  return {
    tree: nextTree,
    report: {
      repaired: changes.length > 0,
      changes,
    },
  };
}
