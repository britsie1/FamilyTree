import type { TreeData, Person, Gender } from '../types/tree';
import { getPersonDisplayName } from './treeOperations';

export type RelationshipCategory =
  | 'self'
  | 'direct'
  | 'sibling'
  | 'collateral'
  | 'cousin'
  | 'spouse'
  | 'in-law'
  | 'step'
  | 'extended'
  | 'none';

export interface PathStep {
  personId: string;
  personName: string;
  relationToNext?: string;
}

export interface RelationshipResult {
  fromPersonId: string;
  toPersonId: string;
  /** Name of relationship of person B relative to person A (e.g. "Aunt", "Second cousin") */
  relationshipName: string;
  /** Name of inverse relationship of person A relative to person B (e.g. "Nephew", "Second cousin") */
  inverseRelationshipName: string;
  /** Full natural sentence headline e.g. "Margaret Miller is Alex Smith's Aunt" */
  headline: string;
  /** Full natural sentence inverse headline e.g. "Alex Smith is Margaret Miller's Nephew" */
  inverseHeadline: string;
  /** Descriptive explanation of the relationship link */
  description: string;
  /** Common ancestor person objects (if blood related) */
  commonAncestors: Person[];
  /** Sequence of person IDs connecting person A to person B (inclusive) */
  path: string[];
  /** Human-friendly step-by-step path breakdown */
  pathSteps: PathStep[];
  /** Generational difference: positive if B is younger, negative if B is older, 0 if same generation */
  generationDifference: number;
  /** Category of relationship */
  category: RelationshipCategory;
  /** True if blood-related (shares common ancestors), false if related purely by marriage/affinity */
  isConsanguineous: boolean;
}

/**
 * Returns parent Person objects for a given person.
 */
export function getParents(tree: TreeData, personId: string): Person[] {
  const person = tree.people[personId];
  if (!person) return [];

  const parentIds = new Set<string>();

  // 1. Through person.parentUnionId
  if (person.parentUnionId && tree.unions[person.parentUnionId]) {
    for (const pId of tree.unions[person.parentUnionId].partnerIds) {
      if (pId !== personId && tree.people[pId]) {
        parentIds.add(pId);
      }
    }
  }

  // 2. Through any union having this person as a child
  for (const u of Object.values(tree.unions)) {
    if (u.childrenIds && u.childrenIds.includes(personId)) {
      for (const pId of u.partnerIds) {
        if (pId !== personId && tree.people[pId]) {
          parentIds.add(pId);
        }
      }
    }
  }

  return Array.from(parentIds).map((id) => tree.people[id]);
}

/**
 * Returns child Person objects for a given person.
 */
export function getChildren(tree: TreeData, personId: string): Person[] {
  const person = tree.people[personId];
  if (!person) return [];

  const childIds = new Set<string>();

  // Unions where this person is a partner
  const unionIds = new Set<string>(person.unionIds || []);
  for (const u of Object.values(tree.unions)) {
    if (u.partnerIds && u.partnerIds.includes(personId)) {
      unionIds.add(u.id);
    }
  }

  for (const uId of unionIds) {
    const union = tree.unions[uId];
    if (union && union.childrenIds) {
      for (const cId of union.childrenIds) {
        if (tree.people[cId]) {
          childIds.add(cId);
        }
      }
    }
  }

  return Array.from(childIds).map((id) => tree.people[id]);
}

/**
 * Returns partner/spouse Person objects for a given person along with union details.
 */
export function getPartners(
  tree: TreeData,
  personId: string
): Array<{ partner: Person; unionType?: string }> {
  const person = tree.people[personId];
  if (!person) return [];

  const partnerMap = new Map<string, { partner: Person; unionType?: string }>();

  const unionIds = new Set<string>(person.unionIds || []);
  for (const u of Object.values(tree.unions)) {
    if (u.partnerIds && u.partnerIds.includes(personId)) {
      unionIds.add(u.id);
    }
  }

  for (const uId of unionIds) {
    const union = tree.unions[uId];
    if (union) {
      for (const pId of union.partnerIds) {
        if (pId !== personId && tree.people[pId]) {
          partnerMap.set(pId, {
            partner: tree.people[pId],
            unionType: union.type,
          });
        }
      }
    }
  }

  return Array.from(partnerMap.values());
}

/**
 * Returns full and half siblings of a person.
 */
export function getSiblings(
  tree: TreeData,
  personId: string
): { fullSiblings: Person[]; halfSiblings: Person[] } {
  const person = tree.people[personId];
  if (!person) return { fullSiblings: [], halfSiblings: [] };

  const myParents = getParents(tree, personId);
  if (myParents.length === 0) return { fullSiblings: [], halfSiblings: [] };

  const myParentIdSet = new Set(myParents.map((p) => p.id));
  const candidateMap = new Map<string, number>(); // candidateId -> shared parent count

  for (const parent of myParents) {
    const parentChildren = getChildren(tree, parent.id);
    for (const child of parentChildren) {
      if (child.id === personId) continue;
      candidateMap.set(child.id, (candidateMap.get(child.id) || 0) + 1);
    }
  }

  const fullSiblings: Person[] = [];
  const halfSiblings: Person[] = [];

  for (const [candidateId, sharedCount] of candidateMap.entries()) {
    const candidate = tree.people[candidateId];
    if (!candidate) continue;

    if (myParentIdSet.size >= 2 && sharedCount >= 2) {
      fullSiblings.push(candidate);
    } else if (myParentIdSet.size === 1 && sharedCount === 1) {
      // If we only know 1 parent for the person, check if candidate also only has 1 known parent and both share parentUnionId
      if (
        person.parentUnionId &&
        candidate.parentUnionId &&
        person.parentUnionId === candidate.parentUnionId
      ) {
        fullSiblings.push(candidate);
      } else {
        // Shared single known parent
        const candidateParents = getParents(tree, candidateId);
        if (candidateParents.length === 1 && candidateParents[0].id === myParents[0].id) {
          fullSiblings.push(candidate);
        } else {
          halfSiblings.push(candidate);
        }
      }
    } else {
      halfSiblings.push(candidate);
    }
  }

  return { fullSiblings, halfSiblings };
}

/**
 * Traverses upwards to gather all ancestors of a person, mapping ancestorId -> { distance, path }.
 * Distance 1 = parent, 2 = grandparent, etc.
 */
export function getAllAncestors(
  tree: TreeData,
  personId: string
): Map<string, { distance: number; path: string[] }> {
  const ancestors = new Map<string, { distance: number; path: string[] }>();
  const queue: Array<{ id: string; distance: number; path: string[] }> = [
    { id: personId, distance: 0, path: [personId] },
  ];
  const visited = new Set<string>([personId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const parents = getParents(tree, current.id);

    for (const parent of parents) {
      if (!visited.has(parent.id)) {
        visited.add(parent.id);
        const dist = current.distance + 1;
        const newPath = [...current.path, parent.id];
        ancestors.set(parent.id, { distance: dist, path: newPath });
        queue.push({ id: parent.id, distance: dist, path: newPath });
      }
    }
  }

  return ancestors;
}

/**
 * Formats gender-specific term for direct lineage (child / parent).
 */
function getDirectTerm(distance: number, gender?: Gender, isDown: boolean = false): string {
  if (isDown) {
    if (distance === 1) {
      if (gender === 'male') return 'Son';
      if (gender === 'female') return 'Daughter';
      return 'Child';
    }
    if (distance === 2) {
      if (gender === 'male') return 'Grandson';
      if (gender === 'female') return 'Granddaughter';
      return 'Grandchild';
    }
    if (distance === 3) {
      if (gender === 'male') return 'Great-grandson';
      if (gender === 'female') return 'Great-granddaughter';
      return 'Great-grandchild';
    }
    if (distance === 4) {
      if (gender === 'male') return 'Great-great-grandson';
      if (gender === 'female') return 'Great-great-granddaughter';
      return 'Great-great-grandchild';
    }
    const prefix = getOrdinal(distance - 2) + ' Great-grand';
    if (gender === 'male') return prefix + 'son';
    if (gender === 'female') return prefix + 'daughter';
    return prefix + 'child';
  } else {
    if (distance === 1) {
      if (gender === 'male') return 'Father';
      if (gender === 'female') return 'Mother';
      return 'Parent';
    }
    if (distance === 2) {
      if (gender === 'male') return 'Grandfather';
      if (gender === 'female') return 'Grandmother';
      return 'Grandparent';
    }
    if (distance === 3) {
      if (gender === 'male') return 'Great-grandfather';
      if (gender === 'female') return 'Great-grandmother';
      return 'Great-grandparent';
    }
    if (distance === 4) {
      if (gender === 'male') return 'Great-great-grandfather';
      if (gender === 'female') return 'Great-great-grandmother';
      return 'Great-great-grandparent';
    }
    const prefix = getOrdinal(distance - 2) + ' Great-grand';
    if (gender === 'male') return prefix + 'father';
    if (gender === 'female') return prefix + 'mother';
    return prefix + 'parent';
  }
}

/**
 * Returns ordinal string, e.g. 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th".
 */
export function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Formats cousin term based on cousin degree C (1 = first cousin, 2 = second cousin)
 * and removed count R (0 = "", 1 = "once removed", etc.)
 */
function getCousinTerm(degree: number, removed: number, isHalf: boolean = false, isDouble: boolean = false): string {
  let base = '';
  if (degree === 1) base = 'First cousin';
  else if (degree === 2) base = 'Second cousin';
  else if (degree === 3) base = 'Third cousin';
  else base = `${getOrdinal(degree)} cousin`;

  if (isDouble && degree === 1 && removed === 0) {
    base = 'Double first cousin';
  } else if (isHalf) {
    base = 'Half-' + base.toLowerCase();
  }

  if (removed === 1) {
    base += ' once removed';
  } else if (removed === 2) {
    base += ' twice removed';
  } else if (removed > 2) {
    base += ` ${removed} times removed`;
  }

  return base;
}

/**
 * Formats collateral aunt/uncle or niece/nephew term.
 */
function getCollateralTerm(
  generationsAbove: number,
  generationsBelow: number,
  gender?: Gender,
  isHalf: boolean = false
): string {
  // generationsAbove >= 2, generationsBelow === 1: B is aunt/uncle of A
  if (generationsAbove >= 2 && generationsBelow === 1) {
    const k = generationsAbove - 1; // k=1: Aunt/Uncle, k=2: Great-aunt/uncle, k=3: Great-great-aunt/uncle
    let title = '';
    if (gender === 'male') title = 'Uncle';
    else if (gender === 'female') title = 'Aunt';
    else title = 'Aunt/Uncle';

    if (k === 1) {
      return isHalf ? `Half-${title.toLowerCase()}` : title;
    }
    if (k === 2) {
      const great = `Great-${title.toLowerCase()}`;
      return isHalf ? `Half-${great.toLowerCase()}` : great;
    }
    if (k === 3) {
      const gg = `Great-great-${title.toLowerCase()}`;
      return isHalf ? `Half-${gg.toLowerCase()}` : gg;
    }
    return `${getOrdinal(k - 1)} Great-${title.toLowerCase()}`;
  }

  // generationsAbove === 1, generationsBelow >= 2: B is niece/nephew of A
  if (generationsAbove === 1 && generationsBelow >= 2) {
    const k = generationsBelow - 1; // k=1: Niece/Nephew, k=2: Great-niece/nephew
    let title = '';
    if (gender === 'male') title = 'Nephew';
    else if (gender === 'female') title = 'Niece';
    else title = 'Niece/Nephew';

    if (k === 1) {
      return isHalf ? `Half-${title.toLowerCase()}` : title;
    }
    if (k === 2) {
      const great = `Great-${title.toLowerCase()}`;
      return isHalf ? `Half-${great.toLowerCase()}` : great;
    }
    if (k === 3) {
      const gg = `Great-great-${title.toLowerCase()}`;
      return isHalf ? `Half-${gg.toLowerCase()}` : gg;
    }
    return `${getOrdinal(k - 1)} Great-${title.toLowerCase()}`;
  }

  return 'Relative';
}

/**
 * Formats sibling term.
 */
function getSiblingTerm(gender?: Gender, isHalf: boolean = false): string {
  let title = 'Sibling';
  if (gender === 'male') title = 'Brother';
  else if (gender === 'female') title = 'Sister';

  return isHalf ? `Half-${title.toLowerCase()}` : title;
}

/**
 * Builds human-readable path steps between persons in tree.
 */
export function buildPathSteps(tree: TreeData, path: string[]): PathStep[] {
  const steps: PathStep[] = [];
  for (let i = 0; i < path.length; i++) {
    const pId = path[i];
    const person = tree.people[pId];
    const name = person ? getPersonDisplayName(person) : pId;

    let relationToNext: string | undefined = undefined;
    if (i < path.length - 1) {
      const nextId = path[i + 1];
      const parents = getParents(tree, pId);
      const children = getChildren(tree, pId);
      const partners = getPartners(tree, pId);

      if (parents.some((p) => p.id === nextId)) {
        const nextPerson = tree.people[nextId];
        relationToNext = nextPerson?.gender === 'male' ? 'father' : nextPerson?.gender === 'female' ? 'mother' : 'parent';
      } else if (children.some((c) => c.id === nextId)) {
        const nextPerson = tree.people[nextId];
        relationToNext = nextPerson?.gender === 'male' ? 'son' : nextPerson?.gender === 'female' ? 'daughter' : 'child';
      } else if (partners.some((pr) => pr.partner.id === nextId)) {
        const nextPerson = tree.people[nextId];
        relationToNext = nextPerson?.gender === 'male' ? 'husband' : nextPerson?.gender === 'female' ? 'wife' : 'spouse';
      } else {
        relationToNext = 'relative';
      }
    }

    steps.push({
      personId: pId,
      personName: name,
      relationToNext,
    });
  }
  return steps;
}

/**
 * General BFS search to find the shortest person-to-person path in the family graph.
 */
export function findShortestPath(tree: TreeData, startId: string, endId: string): string[] | null {
  if (startId === endId) return [startId];

  const queue: Array<{ id: string; path: string[] }> = [{ id: startId, path: [startId] }];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const { id, path } = current;

    // Collect all immediate neighbors (parents, children, partners)
    const neighbors = new Set<string>();

    for (const p of getParents(tree, id)) neighbors.add(p.id);
    for (const c of getChildren(tree, id)) neighbors.add(c.id);
    for (const pr of getPartners(tree, id)) neighbors.add(pr.partner.id);

    for (const neighborId of neighbors) {
      if (neighborId === endId) {
        return [...path, neighborId];
      }
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ id: neighborId, path: [...path, neighborId] });
      }
    }
  }

  return null;
}

/**
 * Calculates biological/blood relationship (direct lineage, siblings, collateral, cousins).
 * Returns null if the two persons are not blood relatives (no shared ancestors).
 * Guaranteed to be non-recursive.
 */
export function findConsanguineousRelationship(
  tree: TreeData,
  fromPersonId: string,
  toPersonId: string
): RelationshipResult | null {
  const personA = tree.people[fromPersonId];
  const personB = tree.people[toPersonId];

  if (!personA || !personB) return null;

  const nameA = getPersonDisplayName(personA);
  const nameB = getPersonDisplayName(personB);

  // Self
  if (fromPersonId === toPersonId) {
    return {
      fromPersonId,
      toPersonId,
      relationshipName: 'Self',
      inverseRelationshipName: 'Self',
      headline: `${nameA} is the same person`,
      inverseHeadline: `${nameA} is the same person`,
      description: 'You selected the same person node.',
      commonAncestors: [personA],
      path: [fromPersonId],
      pathSteps: [{ personId: fromPersonId, personName: nameA }],
      generationDifference: 0,
      category: 'self',
      isConsanguineous: true,
    };
  }

  const ancestorsA = getAllAncestors(tree, fromPersonId);
  const ancestorsB = getAllAncestors(tree, toPersonId);

  // Check if B is a direct ancestor of A
  if (ancestorsA.has(toPersonId)) {
    const info = ancestorsA.get(toPersonId)!;
    const distance = info.distance;
    const relB = getDirectTerm(distance, personB.gender, false);
    const relA = getDirectTerm(distance, personA.gender, true);
    const path = info.path; // [A, ..., B]

    return {
      fromPersonId,
      toPersonId,
      relationshipName: relB,
      inverseRelationshipName: relA,
      headline: `${nameB} is ${nameA}'s ${relB}`,
      inverseHeadline: `${nameA} is ${nameB}'s ${relA}`,
      description: `${nameB} is a direct ancestor of ${nameA} (${distance} generation${distance > 1 ? 's' : ''} back).`,
      commonAncestors: [personB],
      path,
      pathSteps: buildPathSteps(tree, path),
      generationDifference: -distance,
      category: 'direct',
      isConsanguineous: true,
    };
  }

  // Check if A is a direct ancestor of B (i.e. B is direct descendant of A)
  if (ancestorsB.has(fromPersonId)) {
    const info = ancestorsB.get(fromPersonId)!;
    const distance = info.distance;
    const relB = getDirectTerm(distance, personB.gender, true);
    const relA = getDirectTerm(distance, personA.gender, false);
    const path = [...info.path].reverse();

    return {
      fromPersonId,
      toPersonId,
      relationshipName: relB,
      inverseRelationshipName: relA,
      headline: `${nameB} is ${nameA}'s ${relB}`,
      inverseHeadline: `${nameA} is ${nameB}'s ${relA}`,
      description: `${nameB} is a direct descendant of ${nameA} (${distance} generation${distance > 1 ? 's' : ''} down).`,
      commonAncestors: [personA],
      path,
      pathSteps: buildPathSteps(tree, path),
      generationDifference: distance,
      category: 'direct',
      isConsanguineous: true,
    };
  }

  // Find shared common ancestors
  const commonAncestorIds: string[] = [];
  for (const aId of ancestorsA.keys()) {
    if (ancestorsB.has(aId)) {
      commonAncestorIds.push(aId);
    }
  }

  if (commonAncestorIds.length > 0) {
    // Sort common ancestors by total distance to find the Most Recent Common Ancestor(s) (MRCA)
    commonAncestorIds.sort((id1, id2) => {
      const d1 = ancestorsA.get(id1)!.distance + ancestorsB.get(id1)!.distance;
      const d2 = ancestorsA.get(id2)!.distance + ancestorsB.get(id2)!.distance;
      return d1 - d2;
    });

    const mrcaId = commonAncestorIds[0];
    const dA = ancestorsA.get(mrcaId)!.distance;
    const dB = ancestorsB.get(mrcaId)!.distance;

    const topMrcaIds = commonAncestorIds.filter(
      (id) => ancestorsA.get(id)!.distance === dA && ancestorsB.get(id)!.distance === dB
    );
    const mrcaPeople = topMrcaIds.map((id) => tree.people[id]).filter(Boolean);
    const isHalf = topMrcaIds.length === 1;

    let isDoubleCousin = false;
    if (dA === 2 && dB === 2 && commonAncestorIds.length >= 4) {
      const parentsA = getParents(tree, fromPersonId);
      const parentsB = getParents(tree, toPersonId);
      if (parentsA.length >= 2 && parentsB.length >= 2) {
        isDoubleCousin = true;
      }
    }

    const pathToMrca = ancestorsA.get(mrcaId)!.path; // [A, ..., MRCA]
    const pathToB = ancestorsB.get(mrcaId)!.path; // [B, ..., MRCA]
    const pathToBReversed = [...pathToB].reverse(); // [MRCA, ..., B]
    const path = [...pathToMrca.slice(0, -1), ...pathToBReversed];
    const genDiff = dB - dA;

    // SIBLINGS: dA === 1 && dB === 1
    if (dA === 1 && dB === 1) {
      const { fullSiblings } = getSiblings(tree, fromPersonId);
      const isFull = fullSiblings.some((s) => s.id === toPersonId);
      const relB = getSiblingTerm(personB.gender, !isFull);
      const relA = getSiblingTerm(personA.gender, !isFull);

      return {
        fromPersonId,
        toPersonId,
        relationshipName: relB,
        inverseRelationshipName: relA,
        headline: `${nameB} is ${nameA}'s ${relB}`,
        inverseHeadline: `${nameA} is ${nameB}'s ${relA}`,
        description: isFull
          ? `${nameB} and ${nameA} share both parents.`
          : `${nameB} and ${nameA} share one parent (${mrcaPeople.map((p) => getPersonDisplayName(p)).join(', ')}).`,
        commonAncestors: mrcaPeople,
        path,
        pathSteps: buildPathSteps(tree, path),
        generationDifference: 0,
        category: 'sibling',
        isConsanguineous: true,
      };
    }

    // COLLATERAL: dA >= 2 && dB === 1 (Uncle / Aunt / Great-aunt / Great-uncle)
    if (dA >= 2 && dB === 1) {
      const relB = getCollateralTerm(dA, dB, personB.gender, isHalf);
      const relA = getCollateralTerm(dB, dA, personA.gender, isHalf);

      return {
        fromPersonId,
        toPersonId,
        relationshipName: relB,
        inverseRelationshipName: relA,
        headline: `${nameB} is ${nameA}'s ${relB}`,
        inverseHeadline: `${nameA} is ${nameB}'s ${relA}`,
        description: `${nameB} is a sibling of ${nameA}'s ${dA === 2 ? 'parent' : getDirectTerm(dA - 1, undefined, false).toLowerCase()}.`,
        commonAncestors: mrcaPeople,
        path,
        pathSteps: buildPathSteps(tree, path),
        generationDifference: - (dA - 1),
        category: 'collateral',
        isConsanguineous: true,
      };
    }

    // COLLATERAL: dA === 1 && dB >= 2 (Niece / Nephew / Great-niece / Great-nephew)
    if (dA === 1 && dB >= 2) {
      const relB = getCollateralTerm(dA, dB, personB.gender, isHalf);
      const relA = getCollateralTerm(dB, dA, personA.gender, isHalf);

      return {
        fromPersonId,
        toPersonId,
        relationshipName: relB,
        inverseRelationshipName: relA,
        headline: `${nameB} is ${nameA}'s ${relB}`,
        inverseHeadline: `${nameA} is ${nameB}'s ${relA}`,
        description: `${nameB} is a descendant of ${nameA}'s sibling.`,
        commonAncestors: mrcaPeople,
        path,
        pathSteps: buildPathSteps(tree, path),
        generationDifference: dB - 1,
        category: 'collateral',
        isConsanguineous: true,
      };
    }

    // COUSINS: dA >= 2 && dB >= 2
    if (dA >= 2 && dB >= 2) {
      const degree = Math.min(dA, dB) - 1;
      const removed = Math.abs(dA - dB);

      const relB = getCousinTerm(degree, removed, isHalf, isDoubleCousin);
      const relA = getCousinTerm(degree, removed, isHalf, isDoubleCousin);

      let removalNote = '';
      if (removed > 0) {
        if (dB > dA) {
          removalNote = ` (${removed} generation${removed > 1 ? 's' : ''} younger: cousin's descendant)`;
        } else {
          removalNote = ` (${removed} generation${removed > 1 ? 's' : ''} older: parent's cousin)`;
        }
      }

      return {
        fromPersonId,
        toPersonId,
        relationshipName: relB,
        inverseRelationshipName: relA,
        headline: `${nameB} is ${nameA}'s ${relB}`,
        inverseHeadline: `${nameA} is ${nameB}'s ${relA}`,
        description: isDoubleCousin
          ? `${nameB} and ${nameA} are double first cousins, sharing all grandparents on both paternal and maternal sides.`
          : `${nameB} and ${nameA} share common ancestor(s): ${mrcaPeople.map((p) => getPersonDisplayName(p)).join(', ')}${removalNote}.`,
        commonAncestors: mrcaPeople,
        path,
        pathSteps: buildPathSteps(tree, path),
        generationDifference: genDiff,
        category: 'cousin',
        isConsanguineous: true,
      };
    }
  }

  return null;
}

/**
 * Main kinship and relationship calculation engine.
 * Determines the relationship of person B relative to person A ("B is A's ...").
 */
export function findRelationship(
  tree: TreeData,
  fromPersonId: string,
  toPersonId: string
): RelationshipResult {
  const personA = tree.people[fromPersonId];
  const personB = tree.people[toPersonId];

  const nameA = personA ? getPersonDisplayName(personA) : 'Person A';
  const nameB = personB ? getPersonDisplayName(personB) : 'Person B';

  // 1. Same person
  if (fromPersonId === toPersonId) {
    return {
      fromPersonId,
      toPersonId,
      relationshipName: 'Self',
      inverseRelationshipName: 'Self',
      headline: `${nameA} is the same person`,
      inverseHeadline: `${nameA} is the same person`,
      description: 'You selected the same person node.',
      commonAncestors: personA ? [personA] : [],
      path: [fromPersonId],
      pathSteps: [{ personId: fromPersonId, personName: nameA }],
      generationDifference: 0,
      category: 'self',
      isConsanguineous: true,
    };
  }

  if (!personA || !personB) {
    return {
      fromPersonId,
      toPersonId,
      relationshipName: 'Unknown',
      inverseRelationshipName: 'Unknown',
      headline: 'Person not found in tree',
      inverseHeadline: 'Person not found in tree',
      description: 'One of the selected individuals could not be found.',
      commonAncestors: [],
      path: [],
      pathSteps: [],
      generationDifference: 0,
      category: 'none',
      isConsanguineous: false,
    };
  }

  // 2. Direct Consanguinity (Blood relatives: parents, children, grandparents, siblings, aunts/uncles, cousins)
  const bloodRel = findConsanguineousRelationship(tree, fromPersonId, toPersonId);
  if (bloodRel) {
    return bloodRel;
  }

  // 3. Direct Partners / Spouses
  const partnersA = getPartners(tree, fromPersonId);
  const directPartnerMatch = partnersA.find((p) => p.partner.id === toPersonId);
  if (directPartnerMatch) {
    const isEx = directPartnerMatch.unionType === 'divorced' || directPartnerMatch.unionType === 'separated';
    let termB = '';
    let termA = '';
    if (personB.gender === 'male') termB = isEx ? 'Ex-husband' : 'Husband';
    else if (personB.gender === 'female') termB = isEx ? 'Ex-wife' : 'Wife';
    else termB = isEx ? 'Former partner' : 'Spouse / Partner';

    if (personA.gender === 'male') termA = isEx ? 'Ex-husband' : 'Husband';
    else if (personA.gender === 'female') termA = isEx ? 'Ex-wife' : 'Wife';
    else termA = isEx ? 'Former partner' : 'Spouse / Partner';

    const path = [fromPersonId, toPersonId];
    return {
      fromPersonId,
      toPersonId,
      relationshipName: termB,
      inverseRelationshipName: termA,
      headline: `${nameB} is ${nameA}'s ${termB}`,
      inverseHeadline: `${nameA} is ${nameB}'s ${termA}`,
      description: isEx
        ? `${nameB} and ${nameA} were formerly married/partnered.`
        : `${nameB} and ${nameA} are partners / married.`,
      commonAncestors: [],
      path,
      pathSteps: buildPathSteps(tree, path),
      generationDifference: 0,
      category: 'spouse',
      isConsanguineous: false,
    };
  }

  // 4. In-Laws / Affinity (Via A's Spouse)
  // Check if B is a blood relative of A's spouse
  for (const partnerInfo of partnersA) {
    const spouse = partnerInfo.partner;
    if (spouse.id === toPersonId) continue;

    const relFromSpouse = findConsanguineousRelationship(tree, spouse.id, toPersonId);
    if (relFromSpouse) {
      // Spouse's parent: Father-in-law / Mother-in-law
      if (relFromSpouse.category === 'direct' && relFromSpouse.generationDifference === -1) {
        let termB = 'Parent-in-law';
        if (personB.gender === 'male') termB = 'Father-in-law';
        else if (personB.gender === 'female') termB = 'Mother-in-law';

        let termA = 'Child-in-law';
        if (personA.gender === 'male') termA = 'Son-in-law';
        else if (personA.gender === 'female') termA = 'Daughter-in-law';

        const path = [fromPersonId, ...relFromSpouse.path];
        return {
          fromPersonId,
          toPersonId,
          relationshipName: termB,
          inverseRelationshipName: termA,
          headline: `${nameB} is ${nameA}'s ${termB}`,
          inverseHeadline: `${nameA} is ${nameB}'s ${termA}`,
          description: `${nameB} is the ${termB.toLowerCase()} of ${nameA} (parent of ${getPersonDisplayName(spouse)}).`,
          commonAncestors: [],
          path,
          pathSteps: buildPathSteps(tree, path),
          generationDifference: -1,
          category: 'in-law',
          isConsanguineous: false,
        };
      }

      // Spouse's sibling: Brother-in-law / Sister-in-law
      if (relFromSpouse.category === 'sibling') {
        let termB = 'Sibling-in-law';
        if (personB.gender === 'male') termB = 'Brother-in-law';
        else if (personB.gender === 'female') termB = 'Sister-in-law';

        let termA = 'Sibling-in-law';
        if (personA.gender === 'male') termA = 'Brother-in-law';
        else if (personA.gender === 'female') termA = 'Sister-in-law';

        const path = [fromPersonId, ...relFromSpouse.path];
        return {
          fromPersonId,
          toPersonId,
          relationshipName: termB,
          inverseRelationshipName: termA,
          headline: `${nameB} is ${nameA}'s ${termB}`,
          inverseHeadline: `${nameA} is ${nameB}'s ${termA}`,
          description: `${nameB} is the sibling of ${nameA}'s spouse (${getPersonDisplayName(spouse)}).`,
          commonAncestors: [],
          path,
          pathSteps: buildPathSteps(tree, path),
          generationDifference: 0,
          category: 'in-law',
          isConsanguineous: false,
        };
      }

      // Spouse's child who is not A's child: Stepson / Stepdaughter
      if (relFromSpouse.category === 'direct' && relFromSpouse.generationDifference === 1) {
        let termB = 'Stepchild';
        if (personB.gender === 'male') termB = 'Stepson';
        else if (personB.gender === 'female') termB = 'Stepdaughter';

        let termA = 'Step-parent';
        if (personA.gender === 'male') termA = 'Stepfather';
        else if (personA.gender === 'female') termA = 'Stepmother';

        const path = [fromPersonId, ...relFromSpouse.path];
        return {
          fromPersonId,
          toPersonId,
          relationshipName: termB,
          inverseRelationshipName: termA,
          headline: `${nameB} is ${nameA}'s ${termB}`,
          inverseHeadline: `${nameA} is ${nameB}'s ${termA}`,
          description: `${nameB} is the child of ${nameA}'s spouse (${getPersonDisplayName(spouse)}).`,
          commonAncestors: [],
          path,
          pathSteps: buildPathSteps(tree, path),
          generationDifference: 1,
          category: 'step',
          isConsanguineous: false,
        };
      }

      // Spouse's aunt/uncle
      if (relFromSpouse.category === 'collateral' && relFromSpouse.generationDifference === -1) {
        let termB = personB.gender === 'male' ? 'Uncle by marriage' : personB.gender === 'female' ? 'Aunt by marriage' : 'Aunt/Uncle by marriage';
        let termA = personA.gender === 'male' ? 'Nephew-in-law' : personA.gender === 'female' ? 'Niece-in-law' : 'Niece/Nephew-in-law';
        const path = [fromPersonId, ...relFromSpouse.path];
        return {
          fromPersonId,
          toPersonId,
          relationshipName: termB,
          inverseRelationshipName: termA,
          headline: `${nameB} is ${nameA}'s ${termB}`,
          inverseHeadline: `${nameA} is ${nameB}'s ${termA}`,
          description: `${nameB} is the aunt/uncle of ${nameA}'s spouse (${getPersonDisplayName(spouse)}).`,
          commonAncestors: [],
          path,
          pathSteps: buildPathSteps(tree, path),
          generationDifference: -1,
          category: 'in-law',
          isConsanguineous: false,
        };
      }
    }
  }

  // 5. In-Laws / Affinity (Via Blood Relative's Spouse)
  // Check if B is the spouse of one of A's blood relatives
  const partnersB = getPartners(tree, toPersonId);
  for (const partnerInfo of partnersB) {
    const spouseOfB = partnerInfo.partner;
    if (spouseOfB.id === fromPersonId) continue;

    const relToSpouseOfB = findConsanguineousRelationship(tree, fromPersonId, spouseOfB.id);
    if (relToSpouseOfB) {
      // Sibling's spouse: Brother-in-law / Sister-in-law
      if (relToSpouseOfB.category === 'sibling') {
        let termB = 'Sibling-in-law';
        if (personB.gender === 'male') termB = 'Brother-in-law';
        else if (personB.gender === 'female') termB = 'Sister-in-law';

        let termA = 'Sibling-in-law';
        if (personA.gender === 'male') termA = 'Brother-in-law';
        else if (personA.gender === 'female') termA = 'Sister-in-law';

        const path = [...relToSpouseOfB.path, toPersonId];
        return {
          fromPersonId,
          toPersonId,
          relationshipName: termB,
          inverseRelationshipName: termA,
          headline: `${nameB} is ${nameA}'s ${termB}`,
          inverseHeadline: `${nameA} is ${nameB}'s ${termA}`,
          description: `${nameB} is married to ${nameA}'s sibling (${getPersonDisplayName(spouseOfB)}).`,
          commonAncestors: [],
          path,
          pathSteps: buildPathSteps(tree, path),
          generationDifference: 0,
          category: 'in-law',
          isConsanguineous: false,
        };
      }

      // Child's spouse: Son-in-law / Daughter-in-law
      if (relToSpouseOfB.category === 'direct' && relToSpouseOfB.generationDifference === 1) {
        let termB = 'Child-in-law';
        if (personB.gender === 'male') termB = 'Son-in-law';
        else if (personB.gender === 'female') termB = 'Daughter-in-law';

        let termA = 'Parent-in-law';
        if (personA.gender === 'male') termA = 'Father-in-law';
        else if (personA.gender === 'female') termA = 'Mother-in-law';

        const path = [...relToSpouseOfB.path, toPersonId];
        return {
          fromPersonId,
          toPersonId,
          relationshipName: termB,
          inverseRelationshipName: termA,
          headline: `${nameB} is ${nameA}'s ${termB}`,
          inverseHeadline: `${nameA} is ${nameB}'s ${termA}`,
          description: `${nameB} is married to ${nameA}'s child (${getPersonDisplayName(spouseOfB)}).`,
          commonAncestors: [],
          path,
          pathSteps: buildPathSteps(tree, path),
          generationDifference: 1,
          category: 'in-law',
          isConsanguineous: false,
        };
      }

      // Parent's spouse (who is not biological parent): Stepfather / Stepmother
      if (relToSpouseOfB.category === 'direct' && relToSpouseOfB.generationDifference === -1) {
        let termB = 'Step-parent';
        if (personB.gender === 'male') termB = 'Stepfather';
        else if (personB.gender === 'female') termB = 'Stepmother';

        let termA = 'Stepchild';
        if (personA.gender === 'male') termA = 'Stepson';
        else if (personA.gender === 'female') termA = 'Stepdaughter';

        const path = [...relToSpouseOfB.path, toPersonId];
        return {
          fromPersonId,
          toPersonId,
          relationshipName: termB,
          inverseRelationshipName: termA,
          headline: `${nameB} is ${nameA}'s ${termB}`,
          inverseHeadline: `${nameA} is ${nameB}'s ${termA}`,
          description: `${nameB} is married to ${nameA}'s parent (${getPersonDisplayName(spouseOfB)}).`,
          commonAncestors: [],
          path,
          pathSteps: buildPathSteps(tree, path),
          generationDifference: -1,
          category: 'step',
          isConsanguineous: false,
        };
      }

      // Aunt/Uncle's spouse: Uncle / Aunt by marriage
      if (relToSpouseOfB.category === 'collateral' && relToSpouseOfB.generationDifference === -1) {
        let termB = personB.gender === 'male' ? 'Uncle by marriage' : personB.gender === 'female' ? 'Aunt by marriage' : 'Aunt/Uncle by marriage';
        let termA = personA.gender === 'male' ? 'Nephew-in-law' : personA.gender === 'female' ? 'Niece-in-law' : 'Niece/Nephew-in-law';

        const path = [...relToSpouseOfB.path, toPersonId];
        return {
          fromPersonId,
          toPersonId,
          relationshipName: termB,
          inverseRelationshipName: termA,
          headline: `${nameB} is ${nameA}'s ${termB}`,
          inverseHeadline: `${nameA} is ${nameB}'s ${termA}`,
          description: `${nameB} is married to ${nameA}'s aunt/uncle (${getPersonDisplayName(spouseOfB)}).`,
          commonAncestors: [],
          path,
          pathSteps: buildPathSteps(tree, path),
          generationDifference: -1,
          category: 'in-law',
          isConsanguineous: false,
        };
      }
    }
  }

  // 6. Step-Siblings (Step-parent's children who don't share parents)
  const parentsA = getParents(tree, fromPersonId);
  for (const parent of parentsA) {
    const parentSpouses = getPartners(tree, parent.id);
    for (const pSpouse of parentSpouses) {
      if (!parentsA.some((p) => p.id === pSpouse.partner.id)) {
        // pSpouse is a step-parent
        const stepSiblings = getChildren(tree, pSpouse.partner.id);
        const match = stepSiblings.find((s) => s.id === toPersonId);
        if (match) {
          let termB = 'Step-sibling';
          if (personB.gender === 'male') termB = 'Stepbrother';
          else if (personB.gender === 'female') termB = 'Stepsister';

          let termA = 'Step-sibling';
          if (personA.gender === 'male') termA = 'Stepbrother';
          else if (personA.gender === 'female') termA = 'Stepsister';

          const path = [fromPersonId, parent.id, pSpouse.partner.id, toPersonId];
          return {
            fromPersonId,
            toPersonId,
            relationshipName: termB,
            inverseRelationshipName: termA,
            headline: `${nameB} is ${nameA}'s ${termB}`,
            inverseHeadline: `${nameA} is ${nameB}'s ${termA}`,
            description: `${nameB} is the child of ${nameA}'s step-parent (${getPersonDisplayName(pSpouse.partner)}).`,
            commonAncestors: [],
            path,
            pathSteps: buildPathSteps(tree, path),
            generationDifference: 0,
            category: 'step',
            isConsanguineous: false,
          };
        }
      }
    }
  }

  // 7. Extended Connection via General Graph Shortest Path
  const shortestPath = findShortestPath(tree, fromPersonId, toPersonId);
  if (shortestPath && shortestPath.length > 2) {
    const pathSteps = buildPathSteps(tree, shortestPath);
    const genA = personA.generation ?? 0;
    const genB = personB.generation ?? 0;
    const genDiff = genB - genA;

    return {
      fromPersonId,
      toPersonId,
      relationshipName: 'Extended Family',
      inverseRelationshipName: 'Extended Family',
      headline: `${nameB} is connected to ${nameA}`,
      inverseHeadline: `${nameA} is connected to ${nameB}`,
      description: `Connected across ${shortestPath.length - 1} family links through ${pathSteps
        .slice(1, -1)
        .map((s) => s.personName)
        .join(' → ')}.`,
      commonAncestors: [],
      path: shortestPath,
      pathSteps,
      generationDifference: genDiff,
      category: 'extended',
      isConsanguineous: false,
    };
  }

  // 8. No Connection Found
  return {
    fromPersonId,
    toPersonId,
    relationshipName: 'No direct relationship',
    inverseRelationshipName: 'No direct relationship',
    headline: `No direct family relationship found`,
    inverseHeadline: `No direct family relationship found`,
    description: `There is no connected genealogical or marital link between ${nameA} and ${nameB} in this tree.`,
    commonAncestors: [],
    path: [],
    pathSteps: [],
    generationDifference: 0,
    category: 'none',
    isConsanguineous: false,
  };
}
