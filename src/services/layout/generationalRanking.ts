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
  generations: Record<string, number>,
  ignoreChildIds: Set<string> = new Set()
): number {
  const p = tree.people[pId];
  if (!p) return Infinity;
  let minChild = Infinity;
  for (const u of Object.values(tree.unions)) {
    if (u.partnerIds.includes(pId) && u.childrenIds) {
      for (const cId of u.childrenIds) {
        if (cId !== pId && !ignoreChildIds.has(cId) && generations[cId] !== undefined) {
          minChild = Math.min(minChild, generations[cId]);
        }
      }
    }
  }
  return minChild !== Infinity ? minChild - 1 : Infinity;
}

export interface InterGenerationalCouple {
  unionId: string;
  /** Partner with the earlier natural generation. Drops down to the younger partner's row. */
  olderId: string;
  /** Partner with the later natural generation. */
  youngerId: string;
}

/**
 * Detects inter-generational marriages: two-partner unions whose partners' natural
 * generations differ by exactly one (e.g. uncle and niece).
 *
 * The natural generation is computed with the candidate marriage removed from the tree,
 * so the marriage itself cannot force both partners onto one row. To avoid false positives:
 *  - both partners must have known parents (parentless in-laws can sit on any row), and
 *  - both partners must still be connected to each other without this marriage
 *    (i.e. they are relatives, not two separate families that happen to differ in rank).
 * Each person is part of at most one detected couple.
 */
export function findInterGenerationalCouples(tree: TreeData): InterGenerationalCouple[] {
  const sortedUnions = Object.values(tree.unions).sort((a, b) => a.id.localeCompare(b.id));

  const hasParents = new Set<string>();
  for (const u of sortedUnions) {
    for (const cId of u.childrenIds || []) hasParents.add(cId);
  }
  for (const p of Object.values(tree.people)) {
    if (p.parentUnionId && tree.unions[p.parentUnionId]) hasParents.add(p.id);
  }

  const areConnectedWithout = (excludeUnionId: string, a: string, b: string): boolean => {
    const adjacency: Record<string, string[]> = {};
    const link = (x: string, y: string) => {
      (adjacency[x] ||= []).push(y);
      (adjacency[y] ||= []).push(x);
    };
    for (const u of sortedUnions) {
      if (u.id === excludeUnionId) continue;
      const members = [...(u.partnerIds || []), ...(u.childrenIds || [])].filter((id) => tree.people[id]);
      for (let i = 1; i < members.length; i++) link(members[0], members[i]);
    }
    const seen = new Set<string>([a]);
    const queue = [a];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === b) return true;
      for (const next of adjacency[cur] || []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  };

  const couples: InterGenerationalCouple[] = [];
  const used = new Set<string>();

  for (const u of sortedUnions) {
    const partners = (u.partnerIds || []).filter((id) => tree.people[id]);
    if (partners.length !== 2 || partners[0] === partners[1]) continue;
    const [a, b] = partners;
    if (used.has(a) || used.has(b)) continue;
    if (!hasParents.has(a) || !hasParents.has(b)) continue;
    if (!areConnectedWithout(u.id, a, b)) continue;

    const unionsWithout = { ...tree.unions };
    delete unionsWithout[u.id];
    const natural = rankGenerations({ ...tree, unions: unionsWithout }, false, []);
    const diff = natural[a] - natural[b];
    if (Math.abs(diff) !== 1) continue;

    couples.push({ unionId: u.id, olderId: diff < 0 ? a : b, youngerId: diff < 0 ? b : a });
    used.add(a);
    used.add(b);
  }

  return couples;
}

/**
 * Re-establishes the ranking invariants after rows were shifted: partners share the
 * highest partner rank and children sit strictly below their parents (ranks only increase).
 */
function relaxGenerations(
  generations: Record<string, number>,
  unions: Union[],
  maxIterations: number
): void {
  let changed = true;
  let iterations = 0;
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    for (const union of unions) {
      const partners = (union.partnerIds || []).filter((id) => generations[id] !== undefined);
      if (partners.length === 0) continue;
      const maxParentGen = Math.max(...partners.map((id) => generations[id]));
      for (const id of partners) {
        if (generations[id] < maxParentGen) {
          generations[id] = maxParentGen;
          changed = true;
        }
      }
      for (const cId of union.childrenIds || []) {
        if (generations[cId] !== undefined && generations[cId] < maxParentGen + 1) {
          generations[cId] = maxParentGen + 1;
          changed = true;
        }
      }
    }
  }
}

/**
 * Places each inter-generational couple (see findInterGenerationalCouples) on one row:
 * the older partner (whose lineage sits higher up) drops down to the younger partner's row.
 * The older partner's parents are NOT pulled down after them (see Phase 2), so the older
 * partner "skips" a row relative to their parents, and the couple's children (and everything
 * below) move down through the normal parent/child ordering.
 */
function applyInterGenerationalRows(
  couples: InterGenerationalCouple[],
  followers: Record<string, string>,
  generations: Record<string, number>,
  sortedUnions: Union[],
  maxIterations: number
): void {
  if (couples.length === 0) return;

  for (const couple of couples) {
    const coupleGen = Math.max(generations[couple.olderId], generations[couple.youngerId]);
    generations[couple.olderId] = coupleGen;
    generations[couple.youngerId] = coupleGen;
  }
  // Siblings and cousins of a dropped partner follow them down so the generation stays level
  for (const [followerId, olderId] of Object.entries(followers)) {
    generations[followerId] = Math.max(generations[followerId], generations[olderId]);
  }
  relaxGenerations(generations, sortedUnions, maxIterations);
}

/** People whose parent union lists `personId` among its partners, or that list them as parent. */
function getParentIds(tree: TreeData, personId: string): string[] {
  const parents = new Set<string>();
  const own = tree.people[personId]?.parentUnionId;
  if (own && tree.unions[own]) {
    for (const pid of tree.unions[own].partnerIds || []) if (tree.people[pid]) parents.add(pid);
  }
  for (const u of Object.values(tree.unions)) {
    if ((u.childrenIds || []).includes(personId)) {
      for (const pid of u.partnerIds || []) if (tree.people[pid]) parents.add(pid);
    }
  }
  parents.delete(personId);
  return Array.from(parents).sort();
}

/**
 * Finds the relatives of each dropped (older) partner that should follow them to the new row:
 * siblings, cousins, second cousins, ... i.e. everyone exactly as many generations below a
 * common (real, recorded) ancestor as the older partner is. Ancestors of either partner (e.g.
 * the niece's parent) must stay above the couple and never follow. Maps followerId -> olderId.
 */
function findRelativeFollowers(
  tree: TreeData,
  couples: InterGenerationalCouple[]
): Record<string, string> {
  const followers: Record<string, string> = {};
  const coupleMembers = new Set(couples.flatMap((c) => [c.olderId, c.youngerId]));

  for (const couple of couples) {
    const descendantsOfCouple = new Set([
      ...getDescendantPersonIds(tree, couple.olderId),
      ...getDescendantPersonIds(tree, couple.youngerId),
    ]);

    // Everyone above the couple must stay above it: ancestors of either partner and those
    // ancestors' spouses (e.g. Klein Lea, the stepmother of the younger partner)
    const mustStayAbove = new Set<string>();
    for (const startId of [couple.olderId, couple.youngerId]) {
      const seen = new Set<string>();
      let up = [startId];
      while (up.length > 0) {
        const nextUp: string[] = [];
        for (const id of up) {
          for (const pid of getParentIds(tree, id)) {
            if (seen.has(pid)) continue;
            seen.add(pid);
            mustStayAbove.add(pid);
            nextUp.push(pid);
            for (const uId of tree.people[pid]?.unionIds || []) {
              for (const spouseId of tree.unions[uId]?.partnerIds || []) {
                if (tree.people[spouseId]) mustStayAbove.add(spouseId);
              }
            }
          }
        }
        up = nextUp;
      }
    }

    // Ancestors of the older partner with their distance (1 = parent, 2 = grandparent, ...)
    const ancestorDist: Record<string, number> = {};
    let frontier = [couple.olderId];
    for (let depth = 1; frontier.length > 0 && depth < 50; depth++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const pid of getParentIds(tree, id)) {
          if (ancestorDist[pid] === undefined && pid !== couple.olderId) {
            ancestorDist[pid] = depth;
            next.push(pid);
          }
        }
      }
      frontier = next;
    }

    for (const [ancestorId, dist] of Object.entries(ancestorDist)) {
      // Walk exactly `dist` generations down from this ancestor
      let level = new Set<string>([ancestorId]);
      for (let i = 0; i < dist; i++) {
        const nextLevel = new Set<string>();
        for (const id of level) {
          // Include children of the person's spouses' other unions too (step-children),
          // e.g. a child Kathleen had with an unlisted father before marrying Kobus
          const household = new Set<string>([id]);
          for (const uId of tree.people[id]?.unionIds || []) {
            for (const pid of tree.unions[uId]?.partnerIds || []) {
              if (tree.people[pid]) household.add(pid);
            }
          }
          for (const memberId of household) {
            for (const uId of tree.people[memberId]?.unionIds || []) {
              for (const cId of tree.unions[uId]?.childrenIds || []) {
                if (tree.people[cId]) nextLevel.add(cId);
              }
            }
          }
        }
        level = nextLevel;
      }

      for (const relId of level) {
        if (relId === couple.olderId || coupleMembers.has(relId)) continue;
        if (mustStayAbove.has(relId)) continue;
        // People above the couple (e.g. the younger partner's parent) never follow
        if (getDescendantPersonIds(tree, relId).has(couple.youngerId)) continue;
        if (getDescendantPersonIds(tree, relId).has(couple.olderId)) continue;
        if (descendantsOfCouple.has(relId)) continue;
        followers[relId] = couple.olderId;
      }
    }
  }
  return followers;
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
  const generations = rankGenerations(tree, true, findInterGenerationalCouples(tree));
  const peopleIds = Object.keys(generations);
  if (peopleIds.length === 0) return generations;

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
 * Core ranking (Phases 1, 1b and 2). When `useExplicit` is false the persisted
 * `person.generation` values are ignored and every rank starts from 0 (natural ranking).
 */
function rankGenerations(
  tree: TreeData,
  useExplicit: boolean,
  interGenCouples: InterGenerationalCouple[]
): Record<string, number> {
  const generations: Record<string, number> = {};
  const peopleIds = Object.keys(tree.people).sort();

  if (peopleIds.length === 0) return generations;

  // Initialize with explicit generations if available, otherwise 0
  peopleIds.forEach((id) => {
    const explicit = tree.people[id]?.generation;
    generations[id] = useExplicit && explicit !== undefined ? explicit : 0;
  });

  const sortedUnions = Object.values(tree.unions).sort((a, b) => a.id.localeCompare(b.id));
  const sortedPeople = Object.values(tree.people).sort((a, b) => a.id.localeCompare(b.id));

  const coupleUnionIds = new Set(interGenCouples.map((c) => c.unionId));
  const siblingFollowers = findRelativeFollowers(tree, interGenCouples);
  // Couple members and the older partner's following siblings are placed by Phase 1b,
  // not by the regular sibling alignment
  const coupleMemberIds = new Set([
    ...interGenCouples.flatMap((c) => [c.olderId, c.youngerId]),
    ...Object.keys(siblingFollowers),
  ]);
  // Older partners (and their following siblings) drop down to their spouse's row,
  // so their parents must not follow them
  const movedDownIds = new Set([
    ...interGenCouples.map((c) => c.olderId),
    ...Object.keys(siblingFollowers),
  ]);

  let changed = true;
  let iterations = 0;
  const maxIterations = peopleIds.length * 3 + 20;

  // Phase 1: Forward ASAP pass (ensures every child is >= parent + 1, and partners are equalized)
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // 1. Children must be at least 1 generation lower than their parents
    for (const union of sortedUnions) {
      if (!union.partnerIds || union.partnerIds.length === 0) {
        // Siblings whose parents are not recorded still share one generational rank
        const kids = (union.childrenIds || []).filter(
          (cId) => generations[cId] !== undefined && !coupleMemberIds.has(cId)
        );
        const maxKidGen = kids.length > 1 ? Math.max(...kids.map((cId) => generations[cId])) : 0;
        for (const cId of kids.length > 1 ? kids : []) {
          if (generations[cId] < maxKidGen) {
            generations[cId] = maxKidGen;
            changed = true;
          }
        }
        continue;
      }

      let maxParentGen = -Infinity;
      for (const pId of union.partnerIds) {
        if (generations[pId] !== undefined) {
          maxParentGen = Math.max(maxParentGen, generations[pId]);
        }
      }
      if (maxParentGen === -Infinity) continue;

      // Partners in a union should be on the same generational rank
      // (inter-generational couples are joined on one row in Phase 1b instead)
      if (!coupleUnionIds.has(union.id)) {
        for (const pId of union.partnerIds) {
          if (generations[pId] < maxParentGen) {
            generations[pId] = maxParentGen;
            changed = true;
          }
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
      // Members of an inter-generational couple are excluded: they leave their siblings' row.
      let maxChildGen = requiredChildGen;
      for (const cId of union.childrenIds) {
        if (generations[cId] !== undefined && !coupleMemberIds.has(cId)) {
          maxChildGen = Math.max(maxChildGen, generations[cId]);
        }
      }
      for (const cId of union.childrenIds) {
        if (coupleMemberIds.has(cId)) continue;
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

  // Phase 1b: Inter-generational marriages (e.g. uncle + niece): the older partner joins
  // the younger partner's row.
  applyInterGenerationalRows(interGenCouples, siblingFollowers, generations, sortedUnions, maxIterations);

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
      // (children who dropped to their inter-generational spouse's row don't drag parents down)
      const pullingChildren = union.childrenIds.filter((cId) => !movedDownIds.has(cId));
      if (pullingChildren.length === 0) continue;
      const minChildGen = Math.min(...pullingChildren.map((cId) => generations[cId] ?? 999));
      if (minChildGen === Infinity || minChildGen === 999) continue;

      let targetGen = minChildGen - 1;
      for (const pId of union.partnerIds) {
        const maxForP = getMaxAllowedGenForPerson(pId, tree, generations, movedDownIds);
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
      if (coupleUnionIds.has(union.id)) continue;
      const maxPartnerGen = Math.max(...union.partnerIds.map((pId) => generations[pId] ?? -Infinity));
      for (const pId of union.partnerIds) {
        const maxAllowed = getMaxAllowedGenForPerson(pId, tree, generations, movedDownIds);
        const target = Math.min(maxPartnerGen, maxAllowed);
        if (target > generations[pId]) {
          generations[pId] = target;
          changed = true;
        }
      }
    }

    // 2c. Siblings under a parent union without partners stay on one row
    // (raised only as far as their own children allow)
    for (const union of sortedUnions) {
      if (union.partnerIds && union.partnerIds.length > 0) continue;
      const kids = (union.childrenIds || []).filter(
        (cId) => generations[cId] !== undefined && !coupleMemberIds.has(cId)
      );
      if (kids.length < 2) continue;
      const maxKidGen = Math.max(...kids.map((cId) => generations[cId]));
      for (const cId of kids) {
        const target = Math.min(
          maxKidGen,
          getMaxAllowedGenForPerson(cId, tree, generations, movedDownIds)
        );
        if (target > generations[cId]) {
          generations[cId] = target;
          changed = true;
        }
      }
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
