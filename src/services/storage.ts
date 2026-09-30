import type { TreeData, Person, NodePositionOverride, LayoutOverrides } from '../types/tree';
import { sanitizeTree, linkPeopleAcrossTrees } from './treeOperations';
import { CURRENT_SCHEMA_VERSION, processTreeIngress } from './schema';
import { readSyncOutbox } from './syncOutbox';
import { reportLocalSave } from './saveStatus';

export type { NodePositionOverride, LayoutOverrides };

export const STORAGE_KEY = 'family_tree_current_v1';

export function generateId(prefix: string = 'node'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

export function isPresetTreeId(id: string): boolean {
  // Compatibility for saved trees created before example presets were removed.
  if (!id) return false;
  return (
    id === 'tree_double_in_law' ||
    id === 'tree_royal_sample' ||
    id === 'tree_divorce_preset' ||
    id === 'tree_divorce_blended' ||
    id === 'tree_blank' ||
    id.startsWith('preset_')
  );
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
    schemaVersion: CURRENT_SCHEMA_VERSION,
    people,
    unions: {},
    rootPersonId: rootId,
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
    const pending = readSyncOutbox(treeId, store);
    if (pending?.tree && pending.operations.length > 0) {
      return processTreeIngress(pending.tree, { preserveRawOnError: true }).tree;
    }
    const raw = store.getItem(`${TREE_DATA_PREFIX}${treeId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const ingress = processTreeIngress(parsed, { preserveRawOnError: true });
        return ingress.tree;
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
export function saveCurrentTree(tree: TreeData): boolean {
  const store = getLocalStorage();
  const ingress = processTreeIngress(tree);
  const sanitized = ingress.tree;
  sanitized.schemaVersion = CURRENT_SCHEMA_VERSION;
  sanitized.updatedAt = new Date().toISOString();

  if (!store) {
    return typeof window === 'undefined' ? false : reportLocalSave(false);
  }

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
    store.setItem(TREES_INDEX_KEY, JSON.stringify(summaries));

    // 3. Set as active tree
    store.setItem(ACTIVE_TREE_ID_KEY, sanitized.id);

    // 4. Legacy backup sync so older code/tools continue to work
    store.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    return reportLocalSave(true);
  } catch (err) {
    console.error('Failed to save tree to storage:', err);
    return reportLocalSave(false, err);
  }
}

/**
 * Saves a tree and updates its metadata in the index without setting it as active.
 */
export function saveTreeWithoutActivating(tree: TreeData): boolean {
  const store = getLocalStorage();
  const ingress = processTreeIngress(tree);
  const sanitized = ingress.tree;
  sanitized.schemaVersion = CURRENT_SCHEMA_VERSION;
  sanitized.updatedAt = new Date().toISOString();

  if (!store) return typeof window === 'undefined' ? false : reportLocalSave(false);

  try {
    store.setItem(`${TREE_DATA_PREFIX}${sanitized.id}`, JSON.stringify(sanitized));
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
    store.setItem(TREES_INDEX_KEY, JSON.stringify(summaries));
    return reportLocalSave(true);
  } catch (err) {
    console.error('Failed to save tree without activating:', err);
    return reportLocalSave(false, err);
  }
}

/**
 * Updates a person in a stored tree directly in local storage.
 */
export function updatePersonInStoredTree(
  treeId: string,
  personId: string,
  updates: Partial<Person>
): TreeData | null {
  const target = loadTreeById(treeId);
  if (!target || !target.people[personId]) return null;

  target.people[personId] = {
    ...target.people[personId],
    ...updates,
  };

  saveTreeWithoutActivating(target);
  return target;
}

/**
 * Links a person on current tree with a person on another stored tree bidirectionally.
 */
export function linkTreesBetweenPeople(
  currentTree: TreeData,
  currentPersonId: string,
  targetTreeId: string,
  targetPersonId: string,
  options?: {
    isCloudCurrent?: boolean;
    isCloudTarget?: boolean;
    targetTreeData?: TreeData;
  }
): { updatedCurrentTree: TreeData; updatedTargetTree: TreeData | null } {
  const targetTree = options?.targetTreeData || loadTreeById(targetTreeId);
  if (!targetTree) {
    return { updatedCurrentTree: currentTree, updatedTargetTree: null };
  }

  const { updatedTreeA, updatedTreeB } = linkPeopleAcrossTrees(
    currentTree,
    currentPersonId,
    targetTree,
    targetPersonId,
    {
      isCloudA: options?.isCloudCurrent,
      isCloudB: options?.isCloudTarget,
    }
  );

  saveTreeWithoutActivating(updatedTreeB);

  return { updatedCurrentTree: updatedTreeA, updatedTargetTree: updatedTreeB };
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
  const newTree = { ...createBlankTree(), name };

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
    schemaVersion: CURRENT_SCHEMA_VERSION,
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
    nextActive = createBlankTree();
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

  // New workspaces start with a blank tree
  const defaultTree = createBlankTree();
  saveCurrentTree(defaultTree);
  return defaultTree;
}

/**
 * Sanitizes a tree name or string for use in safe filenames across operating systems,
 * preserving Unicode letters and digits (e.g. Cyrillic, Greek, Hebrew, Arabic, CJK, accented Latin)
 * while replacing invalid characters and collapsing separators.
 */
export function sanitizeFilename(name?: string | null, fallback: string = 'family_tree'): string {
  if (!name || typeof name !== 'string') return fallback;
  const sanitized = name.trim().replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '');
  return sanitized || fallback;
}

export function exportTreeToJsonFile(tree: TreeData): void {
  const sanitized = sanitizeTree(tree);
  const jsonStr = JSON.stringify(sanitized, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const sanitizedName = sanitizeFilename(tree.name);
  a.download = `${sanitizedName}_export.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importTreeFromJsonString(jsonString: string): TreeData {
  const parsed = JSON.parse(jsonString);
  const ingress = processTreeIngress(parsed, { preserveRawOnError: true });
  return ingress.tree;
}
