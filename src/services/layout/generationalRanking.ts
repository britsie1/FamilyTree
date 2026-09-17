import type { TreeData, Person, Union } from '../../types/tree';

export interface GenerationGroup {
  level: number;
  peopleIds: string[];
}

/**
 * Calculates the maximum generation a person can be placed at without
 * violating any parent-child constraints (they must be strictly above all their children).
 */
export function getMaxAllowedGenForPerson(
  pId: string,
  tree: TreeData,
  generations: Record<string, number>
): number {
  const p = tree.people[pId];
  if (!p) return Infinity;
  let minChild = Infinity;
  for (const u of Object.values(tree.unions)) {
    if (u.partnerIds.includes(pId) && u.childrenIds) {
      for (const cId of u.childrenIds) {
        if (cId !== pId && generations[cId] !== undefined) {
          minChild = Math.min(minChild, generations[cId]);
        }
      }
    }
  }
  return minChild !== Infinity ? minChild - 1 : Infinity;
}

/**
 * Calculates topological generational levels for all individuals in the tree.
 * Uses a two-phase topological layout:
 * Phase 1 (Forward ASAP): Children must be strictly lower (>= maxParentGen + 1) than their parents,
 *                         and partners in a union share the same generation.
 * Phase 2 (Backward ALAP / Pull-Down): In-laws and ancestors who enter the tree without parents
 *                                      are pulled down so they align directly above their children
 *                                      (e.g. Ana Roque sits on generation 1, directly above daughter Daniela at 2).
 */
export function calculateGenerations(tree: TreeData): Record<string, number> {
  const generations: Record<string, number> = {};
  const peopleIds = Object.keys(tree.people).sort();

  if (peopleIds.length === 0) return generations;

  // Initialize with explicit generations if available, otherwise 0
  peopleIds.forEach((id) => {
    if (tree.people[id]?.generation !== undefined) {
      generations[id] = tree.people[id].generation!;
    } else {
      generations[id] = 0;
    }
  });

  const sortedUnions = Object.values(tree.unions).sort((a, b) => a.id.localeCompare(b.id));
  const sortedPeople = Object.values(tree.people).sort((a, b) => a.id.localeCompare(b.id));

  let changed = true;
  let iterations = 0;
  const maxIterations = peopleIds.length * 3 + 20;

  // Phase 1: Forward ASAP pass (ensures every child is >= parent + 1, and partners are equalized)
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // 1. Children must be at least 1 generation lower than their parents
    for (const union of sortedUnions) {
      if (!union.partnerIds || union.partnerIds.length === 0) continue;

      let maxParentGen = -Infinity;
      for (const pId of union.partnerIds) {
        if (generations[pId] !== undefined) {
          maxParentGen = Math.max(maxParentGen, generations[pId]);
        }
      }
      if (maxParentGen === -Infinity) continue;

      // Partners in a union should be on the same generational rank
      for (const pId of union.partnerIds) {
        if (generations[pId] < maxParentGen) {
          generations[pId] = maxParentGen;
          changed = true;
        }
      }

      // Children are placed in maxParentGen + 1
      const requiredChildGen = maxParentGen + 1;
      for (const cId of union.childrenIds) {
        if (generations[cId] !== undefined && generations[cId] < requiredChildGen) {
          generations[cId] = requiredChildGen;
          changed = true;
        }
      }

      // Siblings in a union share the same generation rank (aligned with their siblings)
      let maxChildGen = requiredChildGen;
      for (const cId of union.childrenIds) {
        if (generations[cId] !== undefined) {
          maxChildGen = Math.max(maxChildGen, generations[cId]);
        }
      }
      for (const cId of union.childrenIds) {
        if (generations[cId] !== undefined && generations[cId] < maxChildGen) {
          generations[cId] = maxChildGen;
          changed = true;
        }
      }
    }

    // 2. Individuals with explicit parentUnionId
    for (const person of sortedPeople) {
      if (person.parentUnionId && tree.unions[person.parentUnionId]) {
        const pUnion = tree.unions[person.parentUnionId];
        if (pUnion.partnerIds && pUnion.partnerIds.length > 0) {
          let maxParentGen = -Infinity;
          for (const pId of pUnion.partnerIds) {
            if (generations[pId] !== undefined) {
              maxParentGen = Math.max(maxParentGen, generations[pId]);
            }
          }
          if (maxParentGen !== -Infinity && generations[person.id] <= maxParentGen) {
            generations[person.id] = maxParentGen + 1;
            changed = true;
          }
        }
      }
    }
  }

  // Phase 2: Pull-down pass (aligns rootless ancestors directly above their children)
  // Prevents in-law parents (like Ana Roque) from floating up on level 0 with great-grandparents
  // when their child (Daniela) is on level 2.
  changed = true;
  iterations = 0;
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // 2a. Pull parents down towards their children
    for (const union of sortedUnions) {
      if (!union.childrenIds || union.childrenIds.length === 0) continue;

      // Find the lowest generation of any child in this union
      const minChildGen = Math.min(...union.childrenIds.map((cId) => generations[cId] ?? 999));
      if (minChildGen === Infinity || minChildGen === 999) continue;

      let targetGen = minChildGen - 1;
      for (const pId of union.partnerIds) {
        const maxForP = getMaxAllowedGenForPerson(pId, tree, generations);
        targetGen = Math.min(targetGen, maxForP);
      }

      for (const pId of union.partnerIds) {
        if (targetGen > generations[pId]) {
          generations[pId] = targetGen;
          changed = true;
        }
      }
    }

    // 2b. Equalize partners across ALL unions (even childless ones), bounded by max allowed generation
    for (const union of Object.values(tree.unions)) {
      if (union.partnerIds.length < 2) continue;
      const maxPartnerGen = Math.max(...union.partnerIds.map((pId) => generations[pId] ?? -Infinity));
      for (const pId of union.partnerIds) {
        const maxAllowed = getMaxAllowedGenForPerson(pId, tree, generations);
        const target = Math.min(maxPartnerGen, maxAllowed);
        if (target > generations[pId]) {
          generations[pId] = target;
          changed = true;
        }
      }
    }
  }

  // Normalize so lowest generation starts at 0 ONLY IF no negative or explicit generations are present
  const hasNegativeGen = Object.values(generations).some((g) => g < 0);
  const hasExplicitGen = Object.values(tree.people).some((p) => p.generation !== undefined);
  if (!hasNegativeGen && !hasExplicitGen) {
    const minGen = Math.min(...Object.values(generations), 0);
    if (minGen < 0) {
      peopleIds.forEach((id) => {
        generations[id] -= minGen;
      });
    }
  }

  return generations;
}

/**
 * Recursively collects all descendant person IDs for a given person.
 */
export function getDescendantPersonIds(tree: TreeData, rootPersonId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [rootPersonId];
  const visited = new Set<string>([rootPersonId]);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const person = tree.people[currId];
    if (!person) continue;

    for (const uId of person.unionIds) {
      const union = tree.unions[uId];
      if (!union) continue;
      for (const cId of union.childrenIds) {
        if (!visited.has(cId)) {
          visited.add(cId);
          descendants.add(cId);
          queue.push(cId);
        }
      }
    }
  }

  return descendants;
}

/**
 * Builds a filtered TreeData removing all descendants of the specified collapsed persons.
 */
export function filterCollapsedTree(
  tree: TreeData,
  collapsedPersonIds: Set<string>
): { visibleTree: TreeData; hiddenCounts: Record<string, number> } {
  if (!collapsedPersonIds || collapsedPersonIds.size === 0) {
    return { visibleTree: tree, hiddenCounts: {} };
  }

  const hiddenPersonIds = new Set<string>();
  const hiddenCounts: Record<string, number> = {};

  for (const pId of collapsedPersonIds) {
    const descendants = getDescendantPersonIds(tree, pId);
    hiddenCounts[pId] = descendants.size;
    for (const dId of descendants) {
      hiddenPersonIds.add(dId);
    }
  }

  if (hiddenPersonIds.size === 0) {
    return { visibleTree: tree, hiddenCounts };
  }

  const nextPeople: Record<string, Person> = {};
  for (const [id, person] of Object.entries(tree.people)) {
    if (!hiddenPersonIds.has(id)) {
      nextPeople[id] = {
        ...person,
        unionIds: (person.unionIds || []).filter((uId) => {
          const u = tree.unions[uId];
          return u && (u.partnerIds.some((pId) => !hiddenPersonIds.has(pId)) || u.childrenIds.some((cId) => !hiddenPersonIds.has(cId)));
        }),
      };
    }
  }

  const nextUnions: Record<string, Union> = {};
  for (const [id, union] of Object.entries(tree.unions)) {
    const visiblePartners = union.partnerIds.filter((pId) => !hiddenPersonIds.has(pId));
    const visibleChildren = union.childrenIds.filter((cId) => !hiddenPersonIds.has(cId));

    if (visiblePartners.length > 0 || visibleChildren.length > 0) {
      nextUnions[id] = {
        ...union,
        partnerIds: visiblePartners,
        childrenIds: visibleChildren,
      };
    }
  }

  const visibleTree: TreeData = {
    ...tree,
    people: nextPeople,
    unions: nextUnions,
  };

  return { visibleTree, hiddenCounts };
}

/**
 * Finds all persons in the lineage of a target person (ancestors, descendants, spouses, and siblings).
 */
export function getBranchPersonIds(tree: TreeData, rootPersonId: string): Set<string> {
  const branchIds = new Set<string>([rootPersonId]);

  // 1. Ancestors
  const ancestorQueue = [rootPersonId];
  while (ancestorQueue.length > 0) {
    const id = ancestorQueue.shift()!;
    const p = tree.people[id];
    if (!p) continue;
    if (p.parentUnionId) {
      const u = tree.unions[p.parentUnionId];
      if (u) {
        for (const partnerId of u.partnerIds) {
          if (!branchIds.has(partnerId)) {
            branchIds.add(partnerId);
            ancestorQueue.push(partnerId);
          }
        }
        for (const siblingId of u.childrenIds) {
          branchIds.add(siblingId);
        }
      }
    }
  }

  // 2. Descendants and Spouses
  const descQueue = Array.from(branchIds);
  while (descQueue.length > 0) {
    const id = descQueue.shift()!;
    const p = tree.people[id];
    if (!p) continue;
    for (const uId of p.unionIds) {
      const u = tree.unions[uId];
      if (u) {
        for (const partnerId of u.partnerIds) {
          branchIds.add(partnerId);
        }
        for (const childId of u.childrenIds) {
          if (!branchIds.has(childId)) {
            branchIds.add(childId);
            descQueue.push(childId);
          }
        }
      }
    }
  }

  return branchIds;
}
