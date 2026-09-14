import type { TreeData, Person, Union } from '../types/tree';
import { generateId } from './storage';
import { calculateGenerations } from './layoutEngine';

/**
 * Returns the display name of a person for tree cards, headers, and relative lists.
 * Uses `knownAs` with `lastName` if present, falling back to `firstName` with `lastName`.
 */
export function getPersonDisplayName(person?: Person | null): string {
  if (!person) return 'Unnamed Person';
  const namePart = (person.knownAs && person.knownAs.trim()) ? person.knownAs.trim() : (person.firstName?.trim() || '');
  const surname = person.lastName?.trim() || '';
  const result = [namePart, surname].filter(Boolean).join(' ');
  return result || 'Unnamed Person';
}

/**
 * Returns the full legal name of a person (firstName + middleNames + lastName).
 */
export function getPersonFullName(person?: Person | null): string {
  if (!person) return 'Unnamed Person';
  const parts = [
    person.firstName?.trim(),
    person.middleNames?.trim(),
    person.lastName?.trim()
  ].filter(Boolean);
  return parts.join(' ') || 'Unnamed Person';
}

/**
 * Creates a blank person with zero required fields.
 */
export function createEmptyPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: overrides.id || generateId('p'),
    firstName: overrides.firstName ?? '',
    middleNames: overrides.middleNames ?? '',
    lastName: overrides.lastName ?? '',
    knownAs: overrides.knownAs ?? '',
    gender: overrides.gender ?? 'unspecified',
    unionIds: overrides.unionIds ?? [],
    ...overrides,
  };
}

/**
 * Normalizes and cleans up the tree structure:
 * 1. Merges duplicate unions that share the exact same set of partners.
 *    - Combines childrenIds (deduplicated).
 *    - Preserves specific status ('divorced', 'separated', 'partner') over default 'married'.
 *    - Preserves dates (marriageDate, divorceDate).
 *    - Re-points all children's parentUnionId to the retained canonical union.
 *    - Cleans up partners' unionIds so duplicate union IDs are removed and canonical union ID is retained.
 *    - Deletes duplicate unions.
 * 2. Cleans up redundant empty 1-partner unions if the person has other active unions.
 * 3. Removes phantom/broken references:
 *    - Person unionIds must exist in tree.unions and include this person in partnerIds.
 *    - Person parentUnionId must exist in tree.unions and include this person in childrenIds.
 *    - Union partnerIds must exist in tree.people and include this union in unionIds.
 *    - Union childrenIds must exist in tree.people and point to this union as parentUnionId.
 *    - Deletes completely empty unions (0 partners, 0 children).
 */
export function sanitizeTree(tree: TreeData): TreeData {
  const nextTree: TreeData = {
    ...tree,
    people: { ...tree.people },
    unions: { ...tree.unions },
  };

  // Step 1: Detect and merge duplicate unions for the same partner pair
  const partnerPairToUnions = new Map<string, Union[]>();
  for (const u of Object.values(nextTree.unions)) {
    if (u.partnerIds.length === 2) {
      const key = [...u.partnerIds].sort().join(':::');
      if (!partnerPairToUnions.has(key)) {
        partnerPairToUnions.set(key, []);
      }
      partnerPairToUnions.get(key)!.push(u);
    }
  }

  for (const group of partnerPairToUnions.values()) {
    if (group.length > 1) {
      // Prefer 'divorced' / 'separated' / 'partner' over default 'married', and prefer one with children/dates
      group.sort((a, b) => {
        const score = (u: Union) => {
          let s = 0;
          if (u.type === 'divorced') s += 10;
          else if (u.type === 'separated') s += 8;
          else if (u.type === 'partner') s += 6;
          else s += 1;
          if (u.childrenIds && u.childrenIds.length > 0) s += 5;
          if (u.divorceDate) s += 4;
          if (u.marriageDate) s += 2;
          return s;
        };
        return score(b) - score(a);
      });

      const canonical = group[0];
      const duplicates = group.slice(1);

      // Collect all unique children from duplicates
      const mergedChildren = new Set(canonical.childrenIds || []);
      for (const dup of duplicates) {
        (dup.childrenIds || []).forEach((cId) => mergedChildren.add(cId));
        if (!canonical.marriageDate && dup.marriageDate) canonical.marriageDate = dup.marriageDate;
        if (!canonical.divorceDate && dup.divorceDate) canonical.divorceDate = dup.divorceDate;
        delete nextTree.unions[dup.id];
      }

      canonical.childrenIds = Array.from(mergedChildren);
      nextTree.unions[canonical.id] = canonical;

      // Update children's parentUnionId
      for (const childId of canonical.childrenIds) {
        if (nextTree.people[childId]) {
          nextTree.people[childId] = {
            ...nextTree.people[childId],
            parentUnionId: canonical.id,
          };
        }
      }

      // Update partners' unionIds
      const dupIdSet = new Set(duplicates.map((d) => d.id));
      canonical.partnerIds.forEach((pId) => {
        if (nextTree.people[pId]) {
          const currentUnionIds = nextTree.people[pId].unionIds || [];
          const filtered = currentUnionIds.filter((id) => !dupIdSet.has(id));
          if (!filtered.includes(canonical.id)) {
            filtered.push(canonical.id);
          }
          nextTree.people[pId] = {
            ...nextTree.people[pId],
            unionIds: filtered,
          };
        }
      });
    }
  }

  // Step 2: Clean up redundant empty 1-partner unions if the person has other active unions
  for (const [uId, u] of Object.entries(nextTree.unions)) {
    if (u.partnerIds.length === 1 && (!u.childrenIds || u.childrenIds.length === 0)) {
      const partnerId = u.partnerIds[0];
      const person = nextTree.people[partnerId];
      if (person) {
        const otherActiveUnions = (person.unionIds || []).filter((id) => {
          if (id === uId) return false;
          const other = nextTree.unions[id];
          return other && (other.partnerIds.length >= 2 || (other.childrenIds && other.childrenIds.length > 0));
        });
        if (otherActiveUnions.length > 0) {
          delete nextTree.unions[uId];
          person.unionIds = person.unionIds.filter((id) => id !== uId);
        }
      }
    } else if (u.partnerIds.length === 0) {
      // If union has 0 partners, check if any of its children actually point to this union as parentUnionId
      const activeChildren = (u.childrenIds || []).filter((cId) => {
        const child = nextTree.people[cId];
        return child && child.parentUnionId === uId;
      });
      if (activeChildren.length === 0) {
        delete nextTree.unions[uId];
      } else {
        nextTree.unions[uId] = {
          ...u,
          childrenIds: activeChildren,
        };
      }
    }
  }

  // Step 3: Clean up broken references across people and unions
  for (const [pId, person] of Object.entries(nextTree.people)) {
    // Clean unionIds
    const validUnionIds = (person.unionIds || []).filter((uId) => {
      const u = nextTree.unions[uId];
      return Boolean(u && u.partnerIds.includes(pId));
    });
    // Clean parentUnionId
    let validParentUnionId = person.parentUnionId;
    if (validParentUnionId) {
      const pu = nextTree.unions[validParentUnionId];
      if (!pu) {
        validParentUnionId = undefined;
      } else if (!pu.childrenIds.includes(pId)) {
        pu.childrenIds.push(pId);
      }
    }
    nextTree.people[pId] = {
      ...person,
      unionIds: validUnionIds,
      parentUnionId: validParentUnionId,
    };
  }

  for (const [uId, u] of Object.entries(nextTree.unions)) {
    const validPartners = u.partnerIds.filter((pId) => Boolean(nextTree.people[pId]));
    const validChildren = u.childrenIds.filter((cId) => Boolean(nextTree.people[cId]));
    nextTree.unions[uId] = {
      ...u,
      partnerIds: validPartners,
      childrenIds: validChildren,
    };
  }

  return nextTree;
}

/**
 * Adds a new child to a person or their union.
 */
export function addChildToPerson(
  tree: TreeData,
  parentPersonId: string,
  preferredUnionId?: string
): { tree: TreeData; newChildId: string } {
  const nextTree: TreeData = {
    ...tree,
    people: { ...tree.people },
    unions: { ...tree.unions },
  };

  const parent = nextTree.people[parentPersonId];
  if (!parent) return { tree, newChildId: '' };

  const currentGens = calculateGenerations(tree);
  const parentGen = parent.generation ?? currentGens[parentPersonId] ?? 0;
  const newChildGen = parentGen + 1;

  Object.keys(nextTree.people).forEach((id) => {
    if (nextTree.people[id].generation === undefined && currentGens[id] !== undefined) {
      nextTree.people[id] = {
        ...nextTree.people[id],
        generation: currentGens[id],
      };
    }
  });

  let targetUnionId = preferredUnionId;

  // If no preferred union, find or create one
  if (!targetUnionId || !nextTree.unions[targetUnionId]) {
    if (parent.unionIds.length > 0) {
      targetUnionId = parent.unionIds[0];
    } else {
      // Create a single-parent or open union for this parent
      const newUnionId = generateId('u');
      const newUnion: Union = {
        id: newUnionId,
        partnerIds: [parentPersonId],
        childrenIds: [],
        type: 'married',
      };
      nextTree.unions[newUnionId] = newUnion;
      nextTree.people[parentPersonId] = {
        ...nextTree.people[parentPersonId],
        unionIds: [...parent.unionIds, newUnionId],
      };
      targetUnionId = newUnionId;
    }
  }

  // Create the new child
  const newChildId = generateId('child');
  const newChild: Person = createEmptyPerson({
    id: newChildId,
    firstName: '',
    lastName: parent.lastName || '',
    parentUnionId: targetUnionId,
    unionIds: [],
    generation: newChildGen,
  });

  // Attach child to union
  const targetUnion = nextTree.unions[targetUnionId];
  nextTree.unions[targetUnionId] = {
    ...targetUnion,
    childrenIds: [...(targetUnion.childrenIds || []), newChildId],
  };

  nextTree.people[newChildId] = newChild;
  return { tree: nextTree, newChildId };
}

/**
 * Adds a sibling to a person.
 * If person has a parentUnion, child is added to that union.
 * If not, a parent union is created automatically.
 */
export function addSiblingToPerson(
  tree: TreeData,
  personId: string
): { tree: TreeData; newSiblingId: string } {
  const nextTree: TreeData = {
    ...tree,
    people: { ...tree.people },
    unions: { ...tree.unions },
  };

  const person = nextTree.people[personId];
  if (!person) return { tree, newSiblingId: '' };

  const currentGens = calculateGenerations(tree);
  const personGen = person.generation ?? currentGens[personId] ?? 0;

  Object.keys(nextTree.people).forEach((id) => {
    if (nextTree.people[id].generation === undefined && currentGens[id] !== undefined) {
      nextTree.people[id] = {
        ...nextTree.people[id],
        generation: currentGens[id],
      };
    }
  });

  let parentUnionId = person.parentUnionId;

  if (!parentUnionId || !nextTree.unions[parentUnionId]) {
    // Automatically create a parents union and an initial parent
    const newParentId = generateId('parent');
    const newParent: Person = createEmptyPerson({
      id: newParentId,
      firstName: 'Parent of',
      lastName: person.lastName || person.firstName || 'Family',
      unionIds: [],
      generation: personGen - 1,
    });

    parentUnionId = generateId('u_parents');
    const newUnion: Union = {
      id: parentUnionId,
      partnerIds: [newParentId],
      childrenIds: [personId],
      type: 'married',
    };

    newParent.unionIds = [parentUnionId];
    nextTree.people[newParentId] = newParent;
    nextTree.unions[parentUnionId] = newUnion;

    // Link original person to this parent union
    nextTree.people[personId] = {
      ...nextTree.people[personId],
      parentUnionId,
      generation: personGen,
    };
  }

  // Create sibling
  const newSiblingId = generateId('sibling');
  const newSibling: Person = createEmptyPerson({
    id: newSiblingId,
    firstName: '',
    lastName: person.lastName || '',
    parentUnionId,
    unionIds: [],
    generation: personGen,
  });

  const parentUnion = nextTree.unions[parentUnionId];
  nextTree.unions[parentUnionId] = {
    ...parentUnion,
    childrenIds: [...(parentUnion.childrenIds || []), newSiblingId],
  };

  nextTree.people[newSiblingId] = newSibling;
  return { tree: nextTree, newSiblingId };
}

/**
 * Adds a partner/spouse and creates a union between them.
 */
export function addPartnerToPerson(
  tree: TreeData,
  personId: string
): { tree: TreeData; newPartnerId: string; newUnionId: string } {
  const sanitized = sanitizeTree(tree);
  const nextTree: TreeData = {
    ...sanitized,
    people: { ...sanitized.people },
    unions: { ...sanitized.unions },
  };

  const person = nextTree.people[personId];
  if (!person) return { tree, newPartnerId: '', newUnionId: '' };

  const currentGens = calculateGenerations(tree);
  const personGen = person.generation ?? currentGens[personId] ?? 0;

  Object.keys(nextTree.people).forEach((id) => {
    if (nextTree.people[id].generation === undefined && currentGens[id] !== undefined) {
      nextTree.people[id] = {
        ...nextTree.people[id],
        generation: currentGens[id],
      };
    }
  });

  const newPartnerId = generateId('partner');
  const newPartner: Person = createEmptyPerson({
    id: newPartnerId,
    firstName: '',
    lastName: '',
    gender: person.gender === 'male' ? 'female' : person.gender === 'female' ? 'male' : 'unspecified',
    unionIds: [],
    generation: personGen,
  });

  // Check if person has an open union (with only 1 partner) we can add newPartner to
  let targetUnionId: string | null = null;
  for (const uId of person.unionIds) {
    const u = nextTree.unions[uId];
    if (u && u.partnerIds.length === 1 && u.partnerIds[0] === personId) {
      targetUnionId = uId;
      break;
    }
  }

  if (targetUnionId) {
    const targetUnion = nextTree.unions[targetUnionId];
    targetUnion.partnerIds = [...targetUnion.partnerIds, newPartnerId];
    newPartner.unionIds = [targetUnionId];
    nextTree.people[newPartnerId] = newPartner;
    return { tree: sanitizeTree(nextTree), newPartnerId, newUnionId: targetUnionId };
  }

  const newUnionId = generateId('u');
  const newUnion: Union = {
    id: newUnionId,
    partnerIds: [personId, newPartnerId],
    childrenIds: [],
    type: 'married',
  };

  newPartner.unionIds = [newUnionId];
  nextTree.people[newPartnerId] = newPartner;
  nextTree.people[personId] = {
    ...nextTree.people[personId],
    unionIds: [...person.unionIds, newUnionId],
    generation: personGen,
  };
  nextTree.unions[newUnionId] = newUnion;

  return { tree: sanitizeTree(nextTree), newPartnerId, newUnionId };
}

/**
 * Adds a parent to a person.
 */
export function addParentToPerson(
  tree: TreeData,
  personId: string
): { tree: TreeData; newParentId: string } {
  const nextTree: TreeData = {
    ...tree,
    people: { ...tree.people },
    unions: { ...tree.unions },
  };

  const person = nextTree.people[personId];
  if (!person) return { tree, newParentId: '' };

  const currentGens = calculateGenerations(tree);
  const personGen = person.generation ?? currentGens[personId] ?? 0;
  const newParentGen = personGen - 1;

  // Preserve existing generations on all people so adding a parent doesn't shift existing nodes
  Object.keys(nextTree.people).forEach((id) => {
    if (nextTree.people[id].generation === undefined && currentGens[id] !== undefined) {
      nextTree.people[id] = {
        ...nextTree.people[id],
        generation: currentGens[id],
      };
    }
  });

  let parentUnionId = person.parentUnionId;
  const newParentId = generateId('parent');

  if (parentUnionId && nextTree.unions[parentUnionId]) {
    const parentUnion = nextTree.unions[parentUnionId];
    // If union only has 1 parent, add the second parent
    if (parentUnion.partnerIds.length < 2) {
      const existingParent = nextTree.people[parentUnion.partnerIds[0]];
      const newParent: Person = createEmptyPerson({
        id: newParentId,
        firstName: '',
        lastName: existingParent?.lastName || person.lastName || '',
        gender: existingParent?.gender === 'male' ? 'female' : existingParent?.gender === 'female' ? 'male' : 'unspecified',
        unionIds: [parentUnionId],
        generation: existingParent?.generation ?? newParentGen,
      });

      nextTree.people[newParentId] = newParent;
      nextTree.unions[parentUnionId] = {
        ...parentUnion,
        partnerIds: [...parentUnion.partnerIds, newParentId],
      };
      return { tree: nextTree, newParentId };
    }
  }

  // Otherwise, create a new parent and union
  parentUnionId = generateId('u_parents');
  const newParent: Person = createEmptyPerson({
    id: newParentId,
    firstName: '',
    lastName: person.lastName || '',
    unionIds: [parentUnionId],
    generation: newParentGen,
  });

  const newUnion: Union = {
    id: parentUnionId,
    partnerIds: [newParentId],
    childrenIds: [personId],
    type: 'married',
  };

  nextTree.people[newParentId] = newParent;
  nextTree.unions[parentUnionId] = newUnion;
  nextTree.people[personId] = {
    ...nextTree.people[personId],
    parentUnionId,
    generation: personGen,
  };

  return { tree: nextTree, newParentId };
}

/**
 * Deletes a person and cleans up all union references.
 */
export function deletePersonFromTree(tree: TreeData, personId: string): TreeData {
  const nextTree: TreeData = {
    ...tree,
    people: { ...tree.people },
    unions: { ...tree.unions },
  };

  delete nextTree.people[personId];

  // Clean up unions
  Object.keys(nextTree.unions).forEach(unionId => {
    const u = nextTree.unions[unionId];
    const newPartners = u.partnerIds.filter(id => id !== personId);
    const newChildren = u.childrenIds.filter(id => id !== personId);

    if (newPartners.length === 0 && newChildren.length === 0) {
      delete nextTree.unions[unionId];
    } else {
      nextTree.unions[unionId] = {
        ...u,
        partnerIds: newPartners,
        childrenIds: newChildren,
      };
    }
  });

  // If root person was deleted, choose another
  if (nextTree.rootPersonId === personId) {
    nextTree.rootPersonId = Object.keys(nextTree.people)[0] || undefined;
  }

  return sanitizeTree(nextTree);
}

/**
 * Updates person attributes.
 */
export function updatePersonInTree(
  tree: TreeData,
  personId: string,
  updates: Partial<Person>
): TreeData {
  const current = tree.people[personId];
  if (!current) return tree;

  return {
    ...tree,
    people: {
      ...tree.people,
      [personId]: {
        ...current,
        ...updates,
      },
    },
  };
}

/**
 * Updates union attributes.
 */
export function updateUnionInTree(
  tree: TreeData,
  unionId: string,
  updates: Partial<Union>
): TreeData {
  const current = tree.unions[unionId];
  if (!current) return tree;

  return {
    ...tree,
    unions: {
      ...tree.unions,
      [unionId]: {
        ...current,
        ...updates,
      },
    },
  };
}

/**
 * Resets any manually dragged node positions so auto-layout takes full effect.
 */
export function clearManualPositions(tree: TreeData): TreeData {
  const nextPeople: Record<string, Person> = {};
  for (const [id, person] of Object.entries(tree.people)) {
    const { x: _x, y: _y, horizontalX: _hx, horizontalY: _hy, ...rest } = person;
    nextPeople[id] = rest;
  }
  return {
    ...tree,
    people: nextPeople,
  };
}

/**
 * Links an EXISTING person as spouse/partner to personA.
 */
export function linkExistingPartner(
  tree: TreeData,
  personAId: string,
  personBId: string
): TreeData {
  if (personAId === personBId) return tree;

  let nextTree = sanitizeTree(tree);
  const pA = nextTree.people[personAId];
  const pB = nextTree.people[personBId];
  if (!pA || !pB) return tree;

  // Check if they already share a union
  const alreadyMarried = Object.values(nextTree.unions).some(
    (u) => u.partnerIds.includes(personAId) && u.partnerIds.includes(personBId)
  );
  if (alreadyMarried) return nextTree;

  // Check if personA has an open union (with only 1 partner) we can add personB to
  let targetUnionId: string | null = null;
  for (const uId of pA.unionIds) {
    const u = nextTree.unions[uId];
    if (u && u.partnerIds.length === 1 && u.partnerIds[0] === personAId) {
      targetUnionId = uId;
      break;
    }
  }

  // If not, check if personB has an open union (with only 1 partner)
  if (!targetUnionId) {
    for (const uId of pB.unionIds) {
      const u = nextTree.unions[uId];
      if (u && u.partnerIds.length === 1 && u.partnerIds[0] === personBId) {
        targetUnionId = uId;
        break;
      }
    }
  }

  if (targetUnionId) {
    const targetUnion = nextTree.unions[targetUnionId];
    if (!targetUnion.partnerIds.includes(personAId)) {
      targetUnion.partnerIds.push(personAId);
    }
    if (!targetUnion.partnerIds.includes(personBId)) {
      targetUnion.partnerIds.push(personBId);
    }
    if (!pA.unionIds.includes(targetUnionId)) {
      pA.unionIds.push(targetUnionId);
    }
    if (!pB.unionIds.includes(targetUnionId)) {
      pB.unionIds.push(targetUnionId);
    }
  } else {
    // Create new union between them
    const newUnionId = generateId('u');
    const newUnion: Union = {
      id: newUnionId,
      partnerIds: [personAId, personBId],
      childrenIds: [],
      type: 'married',
    };
    nextTree.unions[newUnionId] = newUnion;
    nextTree.people[personAId] = {
      ...pA,
      unionIds: [...(pA.unionIds || []), newUnionId],
    };
    nextTree.people[personBId] = {
      ...pB,
      unionIds: [...(pB.unionIds || []), newUnionId],
    };
  }

  return sanitizeTree(nextTree);
}

/**
 * Links an EXISTING person as a child to parentPersonId.
 */
export function linkExistingChild(
  tree: TreeData,
  parentPersonId: string,
  childPersonId: string,
  preferredUnionId?: string
): TreeData {
  if (parentPersonId === childPersonId) return tree;

  let nextTree = sanitizeTree(tree);
  const parent = nextTree.people[parentPersonId];
  const child = nextTree.people[childPersonId];
  if (!parent || !child) return tree;

  // 1. If preferred union is specified and parent is a partner in it
  if (preferredUnionId && nextTree.unions[preferredUnionId]) {
    const union = nextTree.unions[preferredUnionId];
    if (union.partnerIds.includes(parentPersonId)) {
      if (!union.childrenIds.includes(childPersonId)) {
        union.childrenIds.push(childPersonId);
      }
      nextTree.people[childPersonId] = {
        ...child,
        parentUnionId: preferredUnionId,
      };
      return sanitizeTree(nextTree);
    }
  }

  // 2. If child already has a parentUnion, check if that union's partner shares a union with parentPersonId
  if (child.parentUnionId && nextTree.unions[child.parentUnionId]) {
    const currentUnion = nextTree.unions[child.parentUnionId];
    const sharedUnion = Object.values(nextTree.unions).find((u) => {
      return (
        u.partnerIds.includes(parentPersonId) &&
        currentUnion.partnerIds.some((pId) => u.partnerIds.includes(pId))
      );
    });

    if (sharedUnion) {
      if (!sharedUnion.childrenIds.includes(childPersonId)) {
        sharedUnion.childrenIds.push(childPersonId);
      }
      nextTree.people[childPersonId] = {
        ...child,
        parentUnionId: sharedUnion.id,
      };
      currentUnion.childrenIds = currentUnion.childrenIds.filter((id) => id !== childPersonId);
      return sanitizeTree(nextTree);
    }
  }

  // 3. Fallback: attach to parent's first union or create single-parent union
  let targetUnionId = parent.unionIds[0];
  if (!targetUnionId || !nextTree.unions[targetUnionId]) {
    targetUnionId = generateId('u_parents');
    const newUnion: Union = {
      id: targetUnionId,
      partnerIds: [parentPersonId],
      childrenIds: [childPersonId],
      type: 'married',
    };
    nextTree.unions[targetUnionId] = newUnion;
    nextTree.people[parentPersonId] = {
      ...parent,
      unionIds: [...(parent.unionIds || []), targetUnionId],
    };
  } else {
    const union = nextTree.unions[targetUnionId];
    if (!union.childrenIds.includes(childPersonId)) {
      union.childrenIds.push(childPersonId);
    }
  }

  nextTree.people[childPersonId] = {
    ...nextTree.people[childPersonId],
    parentUnionId: targetUnionId,
  };

  return sanitizeTree(nextTree);
}

/**
 * Links an EXISTING person as a parent to childPersonId.
 */
export function linkExistingParent(
  tree: TreeData,
  childPersonId: string,
  parentPersonId: string
): TreeData {
  if (childPersonId === parentPersonId) return tree;

  let nextTree = sanitizeTree(tree);
  const child = nextTree.people[childPersonId];
  const parent = nextTree.people[parentPersonId];
  if (!child || !parent) return tree;

  const currentUnionId = child.parentUnionId;

  if (currentUnionId && nextTree.unions[currentUnionId]) {
    const currentUnion = nextTree.unions[currentUnionId];
    // Already in this union?
    if (currentUnion.partnerIds.includes(parentPersonId)) return nextTree;

    // Check if any partner in currentUnion ALREADY shares a union with parentPersonId
    const existingSharedUnion = Object.values(nextTree.unions).find((u) => {
      if (u.id === currentUnion.id) return false;
      return (
        u.partnerIds.includes(parentPersonId) &&
        currentUnion.partnerIds.some((pId) => u.partnerIds.includes(pId))
      );
    });

    if (existingSharedUnion) {
      // Attach child to this existing shared union!
      if (!existingSharedUnion.childrenIds.includes(childPersonId)) {
        existingSharedUnion.childrenIds.push(childPersonId);
      }
      nextTree.people[childPersonId] = {
        ...child,
        parentUnionId: existingSharedUnion.id,
      };

      // Remove child from old currentUnion
      currentUnion.childrenIds = currentUnion.childrenIds.filter((id) => id !== childPersonId);

      // If currentUnion was a temporary single-parent wrapper that now has 0 children, delete it
      if (currentUnion.childrenIds.length === 0 && currentUnion.partnerIds.length <= 1) {
        delete nextTree.unions[currentUnion.id];
        currentUnion.partnerIds.forEach((pId) => {
          if (nextTree.people[pId]) {
            nextTree.people[pId] = {
              ...nextTree.people[pId],
              unionIds: (nextTree.people[pId].unionIds || []).filter((id) => id !== currentUnion.id),
            };
          }
        });
      }

      return sanitizeTree(nextTree);
    }

    // No existing shared union, and currentUnion has space for 2nd parent: add parentPersonId to this union
    if (currentUnion.partnerIds.length < 2) {
      currentUnion.partnerIds.push(parentPersonId);
      nextTree.people[parentPersonId] = {
        ...parent,
        unionIds: [...(parent.unionIds || []), currentUnion.id],
      };
      return sanitizeTree(nextTree);
    }
  }

  // Child has no parent union OR current parent union is already full (2 parents)
  // Check if parent has an open single-parent union
  let targetUnionId: string | null = null;
  for (const uId of parent.unionIds || []) {
    const u = nextTree.unions[uId];
    if (u && u.partnerIds.length === 1 && u.partnerIds[0] === parentPersonId) {
      targetUnionId = uId;
      break;
    }
  }

  if (!targetUnionId) {
    targetUnionId = generateId('u_parents');
    const newUnion: Union = {
      id: targetUnionId,
      partnerIds: [parentPersonId],
      childrenIds: [childPersonId],
      type: 'married',
    };
    nextTree.unions[targetUnionId] = newUnion;
    nextTree.people[parentPersonId] = {
      ...parent,
      unionIds: [...(parent.unionIds || []), targetUnionId],
    };
  } else {
    const targetUnion = nextTree.unions[targetUnionId];
    if (!targetUnion.childrenIds.includes(childPersonId)) {
      targetUnion.childrenIds.push(childPersonId);
    }
  }

  nextTree.people[childPersonId] = {
    ...nextTree.people[childPersonId],
    parentUnionId: targetUnionId,
  };

  return sanitizeTree(nextTree);
}

/**
 * Links an EXISTING person as a sibling to personA.
 */
export function linkExistingSibling(
  tree: TreeData,
  personAId: string,
  personBId: string
): TreeData {
  if (personAId === personBId) return tree;

  let nextTree = sanitizeTree(tree);
  const pA = nextTree.people[personAId];
  const pB = nextTree.people[personBId];
  if (!pA || !pB) return tree;

  // Case 1: personA already has a parent union
  if (pA.parentUnionId && nextTree.unions[pA.parentUnionId]) {
    const pUnion = nextTree.unions[pA.parentUnionId];
    if (!pUnion.childrenIds.includes(personBId)) {
      pUnion.childrenIds.push(personBId);
    }
    nextTree.people[personBId] = {
      ...pB,
      parentUnionId: pA.parentUnionId,
    };
    return sanitizeTree(nextTree);
  }

  // Case 2: personB has a parent union
  if (pB.parentUnionId && nextTree.unions[pB.parentUnionId]) {
    const pUnion = nextTree.unions[pB.parentUnionId];
    if (!pUnion.childrenIds.includes(personAId)) {
      pUnion.childrenIds.push(personAId);
    }
    nextTree.people[personAId] = {
      ...pA,
      parentUnionId: pB.parentUnionId,
    };
    return sanitizeTree(nextTree);
  }

  // Case 3: Neither has a parent union -> create one
  const newUnionId = generateId('u_parents');
  const newUnion: Union = {
    id: newUnionId,
    partnerIds: [],
    childrenIds: [personAId, personBId],
    type: 'married',
  };
  nextTree.unions[newUnionId] = newUnion;
  nextTree.people[personAId] = {
    ...pA,
    parentUnionId: newUnionId,
  };
  nextTree.people[personBId] = {
    ...pB,
    parentUnionId: newUnionId,
  };

  return sanitizeTree(nextTree);
}

/**
 * Unlinks a specific parent from a child.
 * If the union had 2 parents [P1, P2], unlinking P2 leaves the child attached to P1.
 */
export function unlinkParentFromChild(
  tree: TreeData,
  childPersonId: string,
  parentPersonId: string
): TreeData {
  let nextTree = sanitizeTree(tree);
  const child = nextTree.people[childPersonId];
  if (!child || !child.parentUnionId) return tree;

  const currentUnion = nextTree.unions[child.parentUnionId];
  if (!currentUnion || !currentUnion.partnerIds.includes(parentPersonId)) return tree;

  // Case 1: Union has 2 parents
  if (currentUnion.partnerIds.length >= 2) {
    const otherParentId = currentUnion.partnerIds.find((id) => id !== parentPersonId)!;
    const otherParent = nextTree.people[otherParentId];

    // Remove child from this 2-parent union
    currentUnion.childrenIds = currentUnion.childrenIds.filter((id) => id !== childPersonId);

    // Find or create single-parent union for otherParent
    let singleUnionId = (otherParent?.unionIds || []).find((uId) => {
      const u = nextTree.unions[uId];
      return u && u.partnerIds.length === 1 && u.partnerIds[0] === otherParentId;
    });

    if (!singleUnionId) {
      singleUnionId = generateId('u_parents');
      const newSingleUnion: Union = {
        id: singleUnionId,
        partnerIds: [otherParentId],
        childrenIds: [childPersonId],
        type: 'married',
      };
      nextTree.unions[singleUnionId] = newSingleUnion;
      if (otherParent) {
        nextTree.people[otherParentId] = {
          ...otherParent,
          unionIds: [...(otherParent.unionIds || []), singleUnionId],
        };
      }
    } else {
      const singleUnion = nextTree.unions[singleUnionId];
      if (!singleUnion.childrenIds.includes(childPersonId)) {
        singleUnion.childrenIds.push(childPersonId);
      }
    }

    nextTree.people[childPersonId] = {
      ...child,
      parentUnionId: singleUnionId,
    };

    return sanitizeTree(nextTree);
  }

  // Case 2: Union has only this 1 parent
  currentUnion.childrenIds = currentUnion.childrenIds.filter((id) => id !== childPersonId);
  nextTree.people[childPersonId] = {
    ...child,
    parentUnionId: undefined,
  };

  if (currentUnion.childrenIds.length === 0) {
    delete nextTree.unions[currentUnion.id];
    const parent = nextTree.people[parentPersonId];
    if (parent) {
      nextTree.people[parentPersonId] = {
        ...parent,
        unionIds: (parent.unionIds || []).filter((id) => id !== currentUnion.id),
      };
    }
  }

  return sanitizeTree(nextTree);
}

/**
 * Unlinks a partner from a union.
 */
export function unlinkPartner(
  tree: TreeData,
  personId: string,
  unionId: string
): TreeData {
  const nextTree: TreeData = {
    ...tree,
    people: { ...tree.people },
    unions: { ...tree.unions },
  };

  const person = nextTree.people[personId];
  const union = nextTree.unions[unionId];
  if (!person || !union) return tree;

  nextTree.people[personId] = {
    ...person,
    unionIds: person.unionIds.filter((id) => id !== unionId),
  };

  const remainingPartners = union.partnerIds.filter((id) => id !== personId);
  if (remainingPartners.length === 0 && union.childrenIds.length === 0) {
    delete nextTree.unions[unionId];
  } else {
    nextTree.unions[unionId] = {
      ...union,
      partnerIds: remainingPartners,
    };
  }

  return sanitizeTree(nextTree);
}

/**
 * Unlinks a child from their parent union.
 */
export function unlinkChild(
  tree: TreeData,
  childPersonId: string
): TreeData {
  const nextTree: TreeData = {
    ...tree,
    people: { ...tree.people },
    unions: { ...tree.unions },
  };

  const child = nextTree.people[childPersonId];
  if (!child || !child.parentUnionId) return tree;

  const unionId = child.parentUnionId;
  const union = nextTree.unions[unionId];

  nextTree.people[childPersonId] = {
    ...child,
    parentUnionId: undefined,
  };

  if (union) {
    const remainingChildren = union.childrenIds.filter((id) => id !== childPersonId);
    if (remainingChildren.length === 0 && union.partnerIds.length === 0) {
      delete nextTree.unions[unionId];
    } else {
      nextTree.unions[unionId] = {
        ...union,
        childrenIds: remainingChildren,
      };
    }
  }

  return sanitizeTree(nextTree);
}

/**
 * Creates a brand new independent TreeData containing only the specified subset of people
 * and the valid relationships/unions connecting them.
 */
export function createTreeFromPeople(
  sourceTree: TreeData,
  selectedPersonIds: string[],
  treeName?: string
): TreeData {
  const selectedSet = new Set(selectedPersonIds);
  const newTreeId = generateId('tree');
  const now = new Date().toISOString();

  // 1. Copy selected people and clear manual positions
  const newPeople: Record<string, Person> = {};
  for (const pId of selectedPersonIds) {
    const orig = sourceTree.people[pId];
    if (orig) {
      newPeople[pId] = {
        ...JSON.parse(JSON.stringify(orig)),
        x: undefined,
        y: undefined,
        horizontalX: undefined,
        horizontalY: undefined,
        unionIds: [],
        parentUnionId: undefined,
      };
    }
  }

  // 2. Filter unions connecting the selected people
  const newUnions: Record<string, Union> = {};
  for (const [uId, u] of Object.entries(sourceTree.unions)) {
    const retainedPartners = (u.partnerIds || []).filter((pId) => selectedSet.has(pId));
    const retainedChildren = (u.childrenIds || []).filter((cId) => selectedSet.has(cId));

    // Keep union if:
    // - 2+ partners
    // - 1+ partner and 1+ child
    // - 2+ children (preserving sibling connection even without parents)
    const shouldKeep =
      retainedPartners.length >= 2 ||
      (retainedPartners.length >= 1 && retainedChildren.length >= 1) ||
      (retainedPartners.length === 0 && retainedChildren.length >= 2);

    if (shouldKeep) {
      newUnions[uId] = {
        ...JSON.parse(JSON.stringify(u)),
        partnerIds: retainedPartners,
        childrenIds: retainedChildren,
        x: undefined,
        y: undefined,
      };

      // Link partners
      for (const pId of retainedPartners) {
        if (newPeople[pId] && !newPeople[pId].unionIds.includes(uId)) {
          newPeople[pId].unionIds.push(uId);
        }
      }

      // Link children
      for (const cId of retainedChildren) {
        if (newPeople[cId]) {
          newPeople[cId].parentUnionId = uId;
        }
      }
    }
  }

  // 3. Determine root person
  const rootPersonId =
    sourceTree.rootPersonId && selectedSet.has(sourceTree.rootPersonId)
      ? sourceTree.rootPersonId
      : selectedPersonIds[0] || '';

  // 4. Default name derivation
  let defaultName = treeName?.trim();
  if (!defaultName) {
    const surnames = Object.values(newPeople)
      .map((p) => p.lastName?.trim())
      .filter(Boolean);
    const uniqueSurnames = Array.from(new Set(surnames));
    if (uniqueSurnames.length === 1 && uniqueSurnames[0]) {
      defaultName = `${uniqueSurnames[0]} Family Tree`;
    } else {
      defaultName = `${sourceTree.name || 'Family Tree'} (Branch)`;
    }
  }

  const rawTree: TreeData = {
    id: newTreeId,
    name: defaultName,
    description: `Created from ${Object.keys(newPeople).length} selected members of "${sourceTree.name || 'tree'}".`,
    createdAt: now,
    updatedAt: now,
    people: newPeople,
    unions: newUnions,
    rootPersonId,
  };

  return sanitizeTree(rawTree);
}


