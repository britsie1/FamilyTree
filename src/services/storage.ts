import type { TreeData, Person, Union } from '../types/tree';
import { sanitizeTree } from './treeOperations';

export const STORAGE_KEY = 'family_tree_current_v1';

export function generateId(prefix: string = 'node'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

export function isPresetTreeId(id: string): boolean {
  if (!id) return false;
  return (
    id === 'tree_double_in_law' ||
    id === 'tree_royal_sample' ||
    id === 'tree_divorce_preset' ||
    id === 'tree_blank' ||
    id.startsWith('preset_')
  );
}

// Preset 1: The exact edge case described by the user: Dad's brother marries Mom's sister!
export function createDoubleInLawPreset(): TreeData {
  const treeId = 'tree_double_in_law';
  const now = new Date().toISOString();

  const people: Record<string, Person> = {
    // Grandparents - Paternal side (Smith)
    gf_smith: {
      id: 'gf_smith',
      firstName: 'Arthur',
      lastName: 'Smith',
      gender: 'male',
      birthDate: '1938-04-12',
      birthPlace: 'Chicago, IL',
      isDeceased: false,
      notes: 'Paternal Grandfather',
      unionIds: ['u_smith_grandparents'],
    },
    gm_smith: {
      id: 'gm_smith',
      firstName: 'Eleanor',
      lastName: 'Smith',
      maidenName: 'Davis',
      gender: 'female',
      birthDate: '1940-08-23',
      birthPlace: 'Detroit, MI',
      isDeceased: false,
      notes: 'Paternal Grandmother',
      unionIds: ['u_smith_grandparents'],
    },

    // Grandparents - Maternal side (Miller)
    gf_miller: {
      id: 'gf_miller',
      firstName: 'Robert',
      middleNames: 'Francis',
      knownAs: 'Bob',
      lastName: 'Miller',
      gender: 'male',
      birthDate: '1939-11-05',
      birthPlace: 'Boston, MA',
      isDeceased: false,
      notes: 'Maternal Grandfather (Bob)',
      unionIds: ['u_miller_grandparents'],
    },
    gm_miller: {
      id: 'gm_miller',
      firstName: 'Clara',
      lastName: 'Miller',
      maidenName: 'Wilson',
      gender: 'female',
      birthDate: '1942-02-17',
      birthPlace: 'Providence, RI',
      isDeceased: false,
      notes: 'Maternal Grandmother',
      unionIds: ['u_miller_grandparents'],
    },

    // Generation 2: Brothers (Smith)
    dad: {
      id: 'dad',
      firstName: 'David',
      middleNames: 'Arthur',
      lastName: 'Smith',
      gender: 'male',
      birthDate: '1965-06-14',
      birthPlace: 'Chicago, IL',
      parentUnionId: 'u_smith_grandparents',
      unionIds: ['u_parents'],
      notes: 'Dad',
    },
    uncle: {
      id: 'uncle',
      firstName: 'Daniel',
      middleNames: 'Thomas',
      knownAs: 'Dan',
      lastName: 'Smith',
      gender: 'male',
      birthDate: '1968-09-30',
      birthPlace: 'Chicago, IL',
      parentUnionId: 'u_smith_grandparents',
      unionIds: ['u_aunt_uncle'],
      notes: "Dad's Brother (Uncle Dan)",
    },

    // Generation 2: Sisters (Miller)
    mom: {
      id: 'mom',
      firstName: 'Mary',
      lastName: 'Smith',
      maidenName: 'Miller',
      gender: 'female',
      birthDate: '1967-03-22',
      birthPlace: 'Boston, MA',
      parentUnionId: 'u_miller_grandparents',
      unionIds: ['u_parents'],
      notes: 'Mom',
    },
    aunt: {
      id: 'aunt',
      firstName: 'Margaret',
      lastName: 'Smith',
      maidenName: 'Miller',
      gender: 'female',
      birthDate: '1970-12-08',
      birthPlace: 'Boston, MA',
      parentUnionId: 'u_miller_grandparents',
      unionIds: ['u_aunt_uncle'],
      notes: "Mom's Sister (Aunt Margaret, married to Dad's Brother Daniel)",
    },

    // Generation 3: Children of Dad & Mom
    me: {
      id: 'me',
      firstName: 'Alex',
      lastName: 'Smith',
      gender: 'male',
      birthDate: '1995-05-19',
      birthPlace: 'Denver, CO',
      parentUnionId: 'u_parents',
      unionIds: [],
      notes: 'Primary User ("Me")',
    },
    sibling_me: {
      id: 'sibling_me',
      firstName: 'Samantha',
      lastName: 'Smith',
      gender: 'female',
      birthDate: '1998-08-11',
      birthPlace: 'Denver, CO',
      parentUnionId: 'u_parents',
      unionIds: [],
      notes: 'Sister',
    },

    // Generation 3: Children of Uncle Daniel & Aunt Margaret (Double Cousins!)
    double_cousin_1: {
      id: 'double_cousin_1',
      firstName: 'Christopher',
      lastName: 'Smith',
      gender: 'male',
      birthDate: '1996-01-28',
      birthPlace: 'Seattle, WA',
      parentUnionId: 'u_aunt_uncle',
      unionIds: [],
      notes: 'Double First Cousin (Shares 100% same grandparents as Alex & Samantha!)',
    },
    double_cousin_2: {
      id: 'double_cousin_2',
      firstName: 'Chloe',
      lastName: 'Smith',
      gender: 'female',
      birthDate: '2001-10-15',
      birthPlace: 'Seattle, WA',
      parentUnionId: 'u_aunt_uncle',
      unionIds: [],
      notes: 'Double First Cousin',
    },
  };

  const unions: Record<string, Union> = {
    // Grandparents unions
    u_smith_grandparents: {
      id: 'u_smith_grandparents',
      partnerIds: ['gf_smith', 'gm_smith'],
      childrenIds: ['dad', 'uncle'],
      type: 'married',
      marriageDate: '1963-06-20',
    },
    u_miller_grandparents: {
      id: 'u_miller_grandparents',
      partnerIds: ['gf_miller', 'gm_miller'],
      childrenIds: ['mom', 'aunt'],
      type: 'married',
      marriageDate: '1965-09-12',
    },

    // The two intertwined sibling-sibling marriages:
    // Union 1: David Smith + Mary Miller
    u_parents: {
      id: 'u_parents',
      partnerIds: ['dad', 'mom'],
      childrenIds: ['me', 'sibling_me'],
      type: 'married',
      marriageDate: '1993-07-17',
    },
    // Union 2: Daniel Smith + Margaret Miller
    u_aunt_uncle: {
      id: 'u_aunt_uncle',
      partnerIds: ['uncle', 'aunt'],
      childrenIds: ['double_cousin_1', 'double_cousin_2'],
      type: 'married',
      marriageDate: '1994-10-22',
    },
  };

  return {
    id: treeId,
    name: 'Double In-Law Marriage (Edge Case)',
    description: "Two brothers marrying two sisters. Their children are double first cousins who share both sets of grandparents.",
    createdAt: now,
    updatedAt: now,
    people,
    unions,
    rootPersonId: 'me',
  };
}

export function createBlankTree(): TreeData {
  const now = new Date().toISOString();
  const rootId = generateId('person');
  
  const people: Record<string, Person> = {
    [rootId]: {
      id: rootId,
      firstName: 'New',
      lastName: 'Person',
      gender: 'unspecified',
      unionIds: [],
      notes: 'Root of your new family tree. Click the + buttons on this card to add relatives!',
    },
  };

  return {
    id: generateId('tree'),
    name: 'My Family Tree',
    description: 'A newly created family tree.',
    createdAt: now,
    updatedAt: now,
    people,
    unions: {},
    rootPersonId: rootId,
  };
}

export function createThreeGenSampleTree(): TreeData {
  const now = new Date().toISOString();
  
  const people: Record<string, Person> = {
    p1: { id: 'p1', firstName: 'George', lastName: 'Windsor', gender: 'male', birthDate: '1920-03-10', deathDate: '1995-11-20', isDeceased: true, unionIds: ['u1'] },
    p2: { id: 'p2', firstName: 'Elizabeth', middleNames: 'Alexandra Mary', lastName: 'Windsor', maidenName: 'Bowes', gender: 'female', birthDate: '1925-07-04', deathDate: '2002-04-15', isDeceased: true, unionIds: ['u1'] },
    p3: { id: 'p3', firstName: 'Charles', middleNames: 'Philip Arthur George', lastName: 'Windsor', gender: 'male', birthDate: '1948-11-14', parentUnionId: 'u1', unionIds: ['u2', 'u3'] },
    p4: { id: 'p4', firstName: 'Anne', middleNames: 'Elizabeth Alice Louise', lastName: 'Windsor', gender: 'female', birthDate: '1950-08-15', parentUnionId: 'u1', unionIds: ['u4'] },
    p5: { id: 'p5', firstName: 'Diana', middleNames: 'Frances', lastName: 'Spencer', gender: 'female', birthDate: '1961-07-01', deathDate: '1997-08-31', isDeceased: true, unionIds: ['u2'] },
    p6: { id: 'p6', firstName: 'Camilla', middleNames: 'Rosemary', lastName: 'Shand', gender: 'female', birthDate: '1947-07-17', unionIds: ['u3'] },
    p7: { id: 'p7', firstName: 'William', middleNames: 'Arthur Philip Louis', lastName: 'Windsor', gender: 'male', birthDate: '1982-06-21', parentUnionId: 'u2', unionIds: ['u5'] },
    p8: { id: 'p8', firstName: 'Henry', middleNames: 'Charles Albert David', knownAs: 'Harry', lastName: 'Windsor', gender: 'male', birthDate: '1984-09-15', parentUnionId: 'u2', unionIds: [] },
    p9: { id: 'p9', firstName: 'Catherine', lastName: 'Middleton', gender: 'female', birthDate: '1982-01-09', unionIds: ['u5'] },
    p10: { id: 'p10', firstName: 'George', lastName: 'Windsor', gender: 'male', birthDate: '2013-07-22', parentUnionId: 'u5', unionIds: [] },
    p11: { id: 'p11', firstName: 'Charlotte', lastName: 'Windsor', gender: 'female', birthDate: '2015-05-02', parentUnionId: 'u5', unionIds: [] },
  };

  const unions: Record<string, Union> = {
    u1: { id: 'u1', partnerIds: ['p1', 'p2'], childrenIds: ['p3', 'p4'], type: 'married', marriageDate: '1947-11-20' },
    u2: { id: 'u2', partnerIds: ['p3', 'p5'], childrenIds: ['p7', 'p8'], type: 'divorced' as any, marriageDate: '1981-07-29', divorceDate: '1996-08-28' },
    u3: { id: 'u3', partnerIds: ['p3', 'p6'], childrenIds: [], type: 'married', marriageDate: '2005-04-09' },
    u4: { id: 'u4', partnerIds: ['p4'], childrenIds: [], type: 'married', marriageDate: '1973-11-14' },
    u5: { id: 'u5', partnerIds: ['p7', 'p9'], childrenIds: ['p10', 'p11'], type: 'married', marriageDate: '2011-04-29' },
  };

  return {
    id: 'tree_royal_sample',
    name: 'Multi-Generation Sample Tree',
    description: '3+ Generations showing remarriage, multiple children, and grandchildren.',
    createdAt: now,
    updatedAt: now,
    people,
    unions,
    rootPersonId: 'p7',
  };
}

export function createDivorceBlendedPreset(): TreeData {
  const now = new Date().toISOString();
  const people: Record<string, Person> = {
    p_dan: {
      id: 'p_dan',
      firstName: 'Daniel',
      lastName: 'Carter',
      gender: 'male',
      birthDate: '1980-04-15',
      unionIds: ['u_divorce', 'u_dan_new'],
      notes: 'Previously married to Sarah, now married to Lisa',
    },
    p_sarah: {
      id: 'p_sarah',
      firstName: 'Sarah',
      lastName: 'Jenkins',
      maidenName: 'Evans',
      gender: 'female',
      birthDate: '1982-09-20',
      unionIds: ['u_divorce', 'u_sarah_new'],
      notes: 'Previously married to Daniel, now married to Mark',
    },
    p_lisa: {
      id: 'p_lisa',
      firstName: 'Lisa',
      lastName: 'Carter',
      gender: 'female',
      birthDate: '1984-11-05',
      unionIds: ['u_dan_new'],
      notes: "Daniel's current wife",
    },
    p_mark: {
      id: 'p_mark',
      firstName: 'Mark',
      lastName: 'Jenkins',
      gender: 'male',
      birthDate: '1979-02-18',
      unionIds: ['u_sarah_new'],
      notes: "Sarah's current husband",
    },
    c_shared: {
      id: 'c_shared',
      firstName: 'Emma',
      lastName: 'Carter',
      gender: 'female',
      birthDate: '2008-06-12',
      parentUnionId: 'u_divorce',
      unionIds: [],
      notes: 'Daughter of Daniel & Sarah (shared custody)',
    },
    c_dan: {
      id: 'c_dan',
      firstName: 'Oliver',
      lastName: 'Carter',
      gender: 'male',
      birthDate: '2016-08-25',
      parentUnionId: 'u_dan_new',
      unionIds: [],
      notes: 'Son of Daniel & Lisa (half-sibling to Emma)',
    },
    c_sarah: {
      id: 'c_sarah',
      firstName: 'Sophia',
      lastName: 'Jenkins',
      gender: 'female',
      birthDate: '2017-03-14',
      parentUnionId: 'u_sarah_new',
      unionIds: [],
      notes: 'Daughter of Sarah & Mark (half-sibling to Emma)',
    },
  };

  const unions: Record<string, Union> = {
    u_dan_new: {
      id: 'u_dan_new',
      partnerIds: ['p_lisa', 'p_dan'],
      childrenIds: ['c_dan'],
      type: 'married',
      marriageDate: '2015-05-20',
    },
    u_divorce: {
      id: 'u_divorce',
      partnerIds: ['p_dan', 'p_sarah'],
      childrenIds: ['c_shared'],
      type: 'divorced',
      marriageDate: '2005-06-18',
      divorceDate: '2013-09-10',
    },
    u_sarah_new: {
      id: 'u_sarah_new',
      partnerIds: ['p_sarah', 'p_mark'],
      childrenIds: ['c_sarah'],
      type: 'married',
      marriageDate: '2016-07-15',
    },
  };

  return {
    id: 'tree_divorce_blended',
    name: 'Divorce & Remarriage (Blended Family)',
    description: 'First marriage resulted in a child, then divorced. Both partners remarried and had children with new partners.',
    createdAt: now,
    updatedAt: now,
    people,
    unions,
    rootPersonId: 'c_shared',
  };
}

export interface TreeSummary {
  id: string;
  name: string;
  updatedAt: string;
  peopleCount: number;
  unionCount: number;
}

export const TREES_INDEX_KEY = 'family_trees_index_v2';
export const TREE_DATA_PREFIX = 'family_tree_data_';
export const ACTIVE_TREE_ID_KEY = 'family_tree_active_id';

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // In environments without localStorage
  }
  return null;
}

/**
 * Returns summary list of all trees saved in the multi-tree store.
 */
export function listStoredTrees(): TreeSummary[] {
  const store = getLocalStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(TREES_INDEX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read tree index from storage:', err);
  }
  return [];
}

function saveTreeIndex(summaries: TreeSummary[]): void {
  const store = getLocalStorage();
  if (!store) return;
  try {
    store.setItem(TREES_INDEX_KEY, JSON.stringify(summaries));
  } catch (err) {
    console.error('Failed to save tree index:', err);
  }
}

/**
 * Loads a specific tree by its unique ID.
 */
export function loadTreeById(treeId: string): TreeData | null {
  const store = getLocalStorage();
  if (!store || !treeId) return null;
  try {
    const raw = store.getItem(`${TREE_DATA_PREFIX}${treeId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.people && parsed.unions) {
        return sanitizeTree(parsed);
      }
    }
  } catch (err) {
    console.error(`Failed to load tree ${treeId}:`, err);
  }
  return null;
}

/**
 * Gets the active tree ID, or null if none is set.
 */
export function getActiveTreeId(): string | null {
  const store = getLocalStorage();
  if (!store) return null;
  try {
    return store.getItem(ACTIVE_TREE_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Sets the active tree ID in localStorage.
 */
export function setActiveTreeId(treeId: string): void {
  const store = getLocalStorage();
  if (!store) return;
  try {
    store.setItem(ACTIVE_TREE_ID_KEY, treeId);
  } catch (err) {
    console.error('Failed to set active tree ID:', err);
  }
}

/**
 * Saves a tree, updates its metadata in the index, sets it active, and keeps legacy storage in sync.
 */
export function saveCurrentTree(tree: TreeData): void {
  const store = getLocalStorage();
  const sanitized = sanitizeTree(tree);
  sanitized.updatedAt = new Date().toISOString();

  if (!store) return;

  try {
    // 1. Save specific tree data
    store.setItem(`${TREE_DATA_PREFIX}${sanitized.id}`, JSON.stringify(sanitized));

    // 2. Update index
    const summaries = listStoredTrees();
    const existingIdx = summaries.findIndex((s) => s.id === sanitized.id);
    const summary: TreeSummary = {
      id: sanitized.id,
      name: sanitized.name || 'Untitled Tree',
      updatedAt: sanitized.updatedAt,
      peopleCount: Object.keys(sanitized.people).length,
      unionCount: Object.keys(sanitized.unions).length,
    };

    if (existingIdx >= 0) {
      summaries[existingIdx] = summary;
    } else {
      summaries.unshift(summary);
    }
    saveTreeIndex(summaries);

    // 3. Set as active tree
    setActiveTreeId(sanitized.id);

    // 4. Legacy backup sync so older code/tools continue to work
    store.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.error('Failed to save tree to storage:', err);
  }
}

/**
 * Automatically migrates legacy single-tree storage (STORAGE_KEY) to multi-tree index if needed.
 */
export function migrateLegacyStorage(): void {
  const store = getLocalStorage();
  if (!store) return;

  try {
    const rawIndex = store.getItem(TREES_INDEX_KEY);
    // Only run if index does not exist yet
    if (!rawIndex) {
      const rawLegacy = store.getItem(STORAGE_KEY);
      if (rawLegacy) {
        const legacyTree = JSON.parse(rawLegacy);
        if (legacyTree && legacyTree.people && legacyTree.unions) {
          const sanitized = sanitizeTree(legacyTree);
          saveCurrentTree(sanitized);
        }
      }
    }
  } catch (err) {
    console.error('Error during legacy tree storage migration:', err);
  }
}

/**
 * Creates and persists a brand new empty tree, and sets it active.
 */
export function createAndSaveNewTree(name: string = 'New Family Tree'): TreeData {
  const now = new Date().toISOString();
  const rootId = generateId('person');
  const treeId = generateId('tree');

  const newTree: TreeData = {
    id: treeId,
    name,
    description: 'A newly created family tree.',
    createdAt: now,
    updatedAt: now,
    people: {
      [rootId]: {
        id: rootId,
        firstName: 'New',
        lastName: 'Person',
        gender: 'unspecified',
        unionIds: [],
        notes: 'Root of your new family tree. Click the + buttons on this card to add relatives!',
      },
    },
    unions: {},
    rootPersonId: rootId,
  };

  saveCurrentTree(newTree);
  return newTree;
}

/**
 * Duplicates an existing tree with fresh IDs and saves it as a new copy.
 */
export function duplicateTree(treeId: string): TreeData | null {
  const original = loadTreeById(treeId);
  if (!original) return null;

  const now = new Date().toISOString();
  const newTreeId = generateId('tree');

  const copy: TreeData = {
    ...JSON.parse(JSON.stringify(original)),
    id: newTreeId,
    name: `${original.name || 'Tree'} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };

  saveCurrentTree(copy);
  return copy;
}

/**
 * Deletes a tree from storage. If it was the active tree, returns a fallback active tree.
 */
export function deleteStoredTree(treeId: string): { remaining: TreeSummary[]; newActiveTree: TreeData } {
  const store = getLocalStorage();
  if (store) {
    store.removeItem(`${TREE_DATA_PREFIX}${treeId}`);
    const summaries = listStoredTrees().filter((s) => s.id !== treeId);
    saveTreeIndex(summaries);
  }

  const remaining = listStoredTrees();
  let nextActive: TreeData | null = null;
  if (remaining.length > 0) {
    nextActive = loadTreeById(remaining[0].id);
  }

  if (!nextActive) {
    nextActive = createDoubleInLawPreset();
    saveCurrentTree(nextActive);
  } else {
    setActiveTreeId(nextActive.id);
  }

  return { remaining: listStoredTrees(), newActiveTree: nextActive };
}

/**
 * Loads the active tree, migrating legacy storage if present.
 */
export function loadCurrentTree(): TreeData {
  migrateLegacyStorage();

  const activeId = getActiveTreeId();
  if (activeId) {
    const tree = loadTreeById(activeId);
    if (tree) return tree;
  }

  const trees = listStoredTrees();
  if (trees.length > 0) {
    const firstTree = loadTreeById(trees[0].id);
    if (firstTree) {
      setActiveTreeId(firstTree.id);
      return firstTree;
    }
  }

  // Fallback to Double In-Law preset
  const defaultTree = createDoubleInLawPreset();
  saveCurrentTree(defaultTree);
  return defaultTree;
}

export function exportTreeToJsonFile(tree: TreeData): void {
  const sanitized = sanitizeTree(tree);
  const jsonStr = JSON.stringify(sanitized, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const sanitizedName = (tree.name || 'family_tree').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `${sanitizedName}_export.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importTreeFromJsonString(jsonString: string): TreeData {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON data format');
  }
  if (!parsed.people || !parsed.unions) {
    throw new Error('JSON is missing people or unions record');
  }
  return sanitizeTree(parsed as TreeData);
}
