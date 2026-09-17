import { create } from 'zustand';
import { produceWithPatches, applyPatches, enablePatches, setAutoFreeze, type Patch } from 'immer';
import type { TreeData, Person, Union, UnionType, PersonDocument, GoogleDriveConfig } from '../types/tree';
import { useCanvasStore } from './useCanvasStore';
import { useCollabStore } from './useCollabStore';
import { cloudSyncBridge } from '../services/cloudSyncBridge';
import {
  loadCurrentTree,
  saveCurrentTree,
  generateId,
} from '../services/storage';
import {
  addChildToPerson,
  addSiblingToPerson,
  addPartnerToPerson,
  addParentToPerson,
  linkExistingChild,
  linkExistingPartner,
  linkExistingParent,
  linkExistingSibling,
  unlinkPartner,
  unlinkChild,
  unlinkParentFromChild,
  createEmptyPerson,
  deletePersonFromTree,
  updatePersonInTree,
  updateUnionInTree,
  clearManualPositions,
  attachDocumentToPerson,
  removeDocumentFromPerson,
  updateTreeGoogleDriveConfig,
} from '../services/treeOperations';

enablePatches();
setAutoFreeze(false);

export type { Patch };

export interface HistoryStep {
  patches: Patch[];
  inversePatches: Patch[];
  targetKey?: string;
  timestamp: number;
}

const MAX_HISTORY_DEPTH = 50;
const DEBOUNCE_WINDOW_MS = 500;

function arraysEqual(a: any[] | undefined, b: any[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (typeof a[i] === 'object' && a[i] !== null && typeof b[i] === 'object' && b[i] !== null) {
      if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false;
    } else if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function reconcilePerson(draftPerson: any, nextPerson: Person) {
  for (const key of Object.keys(draftPerson)) {
    if (!(key in nextPerson) || (nextPerson as any)[key] === undefined) {
      if (draftPerson[key] !== undefined) {
        delete draftPerson[key];
      }
    }
  }
  for (const [key, nextVal] of Object.entries(nextPerson)) {
    if (nextVal === undefined) {
      if (draftPerson[key] !== undefined) {
        delete draftPerson[key];
      }
    } else if (Array.isArray(nextVal)) {
      if (!arraysEqual(draftPerson[key], nextVal)) {
        draftPerson[key] = [...nextVal];
      }
    } else if (draftPerson[key] !== nextVal) {
      draftPerson[key] = nextVal;
    }
  }
}

function reconcileUnion(draftUnion: any, nextUnion: Union) {
  for (const key of Object.keys(draftUnion)) {
    if (!(key in nextUnion) || (nextUnion as any)[key] === undefined) {
      if (draftUnion[key] !== undefined) {
        delete draftUnion[key];
      }
    }
  }
  for (const [key, nextVal] of Object.entries(nextUnion)) {
    if (nextVal === undefined) {
      if (draftUnion[key] !== undefined) {
        delete draftUnion[key];
      }
    } else if (Array.isArray(nextVal)) {
      if (!arraysEqual(draftUnion[key], nextVal)) {
        draftUnion[key] = [...nextVal];
      }
    } else if (draftUnion[key] !== nextVal) {
      draftUnion[key] = nextVal;
    }
  }
}

function reconcileTree(draft: any, next: TreeData) {
  for (const key of Object.keys(draft)) {
    if (key === 'people' || key === 'unions') continue;
    if (!(key in next) || (next as any)[key] === undefined) {
      if (draft[key] !== undefined) {
        delete draft[key];
      }
    }
  }

  for (const [key, nextVal] of Object.entries(next)) {
    if (key === 'people' || key === 'unions') continue;
    if (nextVal === undefined) {
      if (draft[key] !== undefined) {
        delete draft[key];
      }
    } else if (Array.isArray(nextVal)) {
      if (!arraysEqual(draft[key], nextVal)) {
        draft[key] = [...nextVal];
      }
    } else if (typeof nextVal === 'object' && nextVal !== null) {
      if (JSON.stringify(draft[key]) !== JSON.stringify(nextVal)) {
        draft[key] = { ...nextVal };
      }
    } else if (draft[key] !== nextVal) {
      draft[key] = nextVal;
    }
  }

  if (draft.people !== next.people) {
    if (!draft.people) draft.people = {};
    const draftPeople = draft.people;
    const nextPeople = next.people || {};
    for (const pId of Object.keys(draftPeople)) {
      if (!(pId in nextPeople)) {
        delete draftPeople[pId];
      }
    }
    for (const [pId, nextPerson] of Object.entries(nextPeople)) {
      const draftPerson = draftPeople[pId];
      if (!draftPerson) {
        draftPeople[pId] = nextPerson;
      } else if (draftPerson !== nextPerson) {
        reconcilePerson(draftPerson, nextPerson);
      }
    }
  }

  if (draft.unions !== next.unions) {
    if (!draft.unions) draft.unions = {};
    const draftUnions = draft.unions;
    const nextUnions = next.unions || {};
    for (const uId of Object.keys(draftUnions)) {
      if (!(uId in nextUnions)) {
        delete draftUnions[uId];
      }
    }
    for (const [uId, nextUnion] of Object.entries(nextUnions)) {
      const draftUnion = draftUnions[uId];
      if (!draftUnion) {
        draftUnions[uId] = nextUnion;
      } else if (draftUnion !== nextUnion) {
        reconcileUnion(draftUnion, nextUnion);
      }
    }
  }
}

function getTargetKey(patches: Patch[]): string {
  const significant = patches.filter((p) => p.path[0] !== 'updatedAt');
  if (significant.length === 0) return '';

  const isPos = significant.every(
    (p) =>
      (p.path.length >= 2 &&
        (p.path[0] === 'layoutOverrides' || p.path[0] === 'horizontalOverrides')) ||
      (p.path.length >= 3 &&
        p.path[0] === 'people' &&
        (p.path[2] === 'x' || p.path[2] === 'y' || p.path[2] === 'horizontalX' || p.path[2] === 'horizontalY'))
  );
  if (isPos && significant.length > 0) {
    const p = significant[0];
    const personId =
      p.path[0] === 'layoutOverrides' || p.path[0] === 'horizontalOverrides'
        ? p.path[1]
        : p.path[1];
    return `layoutOverrides/${personId}:pos`;
  }

  return significant.map((p) => p.path.join('/')).sort().join(';');
}

export interface TreeStoreState {
  tree: TreeData;
  pastPatches: Patch[][];
  futurePatches: Patch[][];
  canUndo: boolean;
  canRedo: boolean;

  // History & setting
  setTree: (
    nextTreeOrUpdater: TreeData | ((prev: TreeData) => TreeData),
    recordHistory?: boolean
  ) => void;
  undo: () => void;
  redo: () => void;
  resetHistory: (newTree: TreeData) => void;

  // Transaction batching & grouping
  beginTransaction: () => void;
  commitTransaction: () => void;
  abortTransaction: () => void;
  batch: <T>(fn: () => T) => T;

  // High-level mutations
  updateTreeName: (name: string) => void;
  updatePerson: (personId: string, updates: Partial<Person>) => void;
  updatePersonPosition: (
    personId: string,
    x: number,
    y: number,
    layoutStyle: 'vertical' | 'horizontal'
  ) => void;
  updateUnion: (
    unionId: string,
    updates: Partial<{ type: UnionType; marriageDate?: string; divorceDate?: string }>
  ) => void;
  deleteUnion: (unionId: string) => void;
  deletePerson: (personId: string) => void;
  addPerson: (overrides?: Partial<Person>) => Person;
  addChild: (personId: string, preferredUnionId?: string) => string;
  addSibling: (personId: string) => string;
  addPartner: (personId: string) => string;
  addParent: (personId: string) => string;
  linkChild: (sourcePersonId: string, targetPersonId: string, preferredUnionId?: string) => void;
  linkSibling: (sourcePersonId: string, targetPersonId: string) => void;
  linkPartner: (sourcePersonId: string, targetPersonId: string) => void;
  linkParent: (sourcePersonId: string, targetPersonId: string) => void;
  unlinkPartnerAction: (personId: string, unionId: string) => void;
  unlinkChildAction: (childPersonId: string) => void;
  unlinkParentFromChildAction: (childPersonId: string, parentPersonId: string) => void;
  resetLayout: () => void;
  makeCopy: () => TreeData;
  attachDocument: (personId: string, doc: PersonDocument) => void;
  removeDocument: (personId: string, documentId: string) => void;
  setGoogleDriveConfig: (config: GoogleDriveConfig | null) => void;
}

const initialTree = loadCurrentTree();

export const useTreeStore = create<TreeStoreState>((set, get) => {
  const historyPast: HistoryStep[] = [];
  const historyFuture: HistoryStep[] = [];
  let isTransactionActive = false;
  let activeTransactionBaseTree: TreeData | null = null;
  let debounceBaseTree: TreeData | null = null;

  const flushDebounce = () => {
    debounceBaseTree = null;
  };

  return {
    tree: initialTree,
    pastPatches: [],
    futurePatches: [],
    canUndo: false,
    canRedo: false,

    setTree: (nextTreeOrUpdater, recordHistory = true) => {
      const currentTree = get().tree;

      // 1. Non-history update
      if (!recordHistory) {
        const nextTree =
          typeof nextTreeOrUpdater === 'function'
            ? (nextTreeOrUpdater as (prev: TreeData) => TreeData)(currentTree)
            : nextTreeOrUpdater;

        if (nextTree === currentTree) {
          return;
        }

        saveCurrentTree(nextTree);
        set({ tree: nextTree });
        return;
      }

      // 2. Transaction update
      if (isTransactionActive) {
        const nextTree =
          typeof nextTreeOrUpdater === 'function'
            ? (nextTreeOrUpdater as (prev: TreeData) => TreeData)(currentTree)
            : nextTreeOrUpdater;

        if (nextTree === currentTree) {
          return;
        }

        saveCurrentTree(nextTree);
        set({ tree: nextTree });
        return;
      }

      // 3. Normal history-recorded mutation
      const [nextTree, patches, inversePatches] = produceWithPatches(
        currentTree,
        (draft) => {
          if (typeof nextTreeOrUpdater === 'function') {
            const res = (nextTreeOrUpdater as any)(draft as TreeData);
            if (res !== undefined && res !== draft) {
              reconcileTree(draft as TreeData, res);
            }
          } else {
            reconcileTree(draft as TreeData, nextTreeOrUpdater);
          }
        }
      );

      if (patches.length === 0) {
        return;
      }

      saveCurrentTree(nextTree);

      const now = Date.now();
      const targetKey = getTargetKey(patches);

      const canDebounce =
        historyPast.length > 0 &&
        targetKey !== '' &&
        debounceBaseTree !== null &&
        historyPast[historyPast.length - 1].targetKey === targetKey &&
        now - historyPast[historyPast.length - 1].timestamp < DEBOUNCE_WINDOW_MS;

      if (canDebounce) {
        const [_, cumulativePatches, cumulativeInversePatches] = produceWithPatches(
          debounceBaseTree,
          (draft) => {
            reconcileTree(draft as TreeData, nextTree);
          }
        );

        if (cumulativePatches.length === 0) {
          historyPast.pop();
          set({
            tree: nextTree,
            pastPatches: historyPast.map((s) => s.patches),
            futurePatches: [],
            canUndo: historyPast.length > 0,
            canRedo: false,
          });
        } else {
          const lastStep = historyPast[historyPast.length - 1];
          lastStep.patches = cumulativePatches;
          lastStep.inversePatches = cumulativeInversePatches;
          lastStep.timestamp = now;

          set({
            tree: nextTree,
            pastPatches: historyPast.map((s) => s.patches),
            futurePatches: [],
            canUndo: true,
            canRedo: false,
          });
        }
      } else {
        debounceBaseTree = currentTree;

        const newStep: HistoryStep = {
          patches,
          inversePatches,
          targetKey,
          timestamp: now,
        };

        historyPast.push(newStep);
        if (historyPast.length > MAX_HISTORY_DEPTH) {
          historyPast.shift();
        }
        historyFuture.length = 0;

        set({
          tree: nextTree,
          pastPatches: historyPast.map((s) => s.patches),
          futurePatches: [],
          canUndo: true,
          canRedo: false,
        });
      }
    },

    undo: () => {
      flushDebounce();

      if (isTransactionActive) {
        get().abortTransaction();
        return;
      }

      if (historyPast.length === 0) return;

      const currentTree = get().tree;
      const step = historyPast.pop()!;
      historyFuture.unshift(step);

      const previousTree = applyPatches(currentTree, step.inversePatches);
      saveCurrentTree(previousTree);

      set({
        tree: previousTree,
        pastPatches: historyPast.map((s) => s.patches),
        futurePatches: historyFuture.map((s) => s.patches),
        canUndo: historyPast.length > 0,
        canRedo: true,
      });
    },

    redo: () => {
      flushDebounce();

      if (historyFuture.length === 0) return;

      const currentTree = get().tree;
      const step = historyFuture.shift()!;
      historyPast.push(step);

      const nextTree = applyPatches(currentTree, step.patches);
      saveCurrentTree(nextTree);

      set({
        tree: nextTree,
        pastPatches: historyPast.map((s) => s.patches),
        futurePatches: historyFuture.map((s) => s.patches),
        canUndo: true,
        canRedo: historyFuture.length > 0,
      });
    },

    resetHistory: (newTree: TreeData) => {
      flushDebounce();
      historyPast.length = 0;
      historyFuture.length = 0;
      isTransactionActive = false;
      activeTransactionBaseTree = null;

      saveCurrentTree(newTree);
      set({
        tree: newTree,
        pastPatches: [],
        futurePatches: [],
        canUndo: false,
        canRedo: false,
      });
    },

    beginTransaction: () => {
      flushDebounce();
      if (!isTransactionActive) {
        isTransactionActive = true;
        activeTransactionBaseTree = get().tree;
      }
    },

    commitTransaction: () => {
      if (!isTransactionActive || !activeTransactionBaseTree) {
        isTransactionActive = false;
        activeTransactionBaseTree = null;
        return;
      }

      const baseTree = activeTransactionBaseTree;
      const currentTree = get().tree;
      isTransactionActive = false;
      activeTransactionBaseTree = null;

      const [_, patches, inversePatches] = produceWithPatches(baseTree, (draft) => {
        reconcileTree(draft as TreeData, currentTree);
      });

      if (patches.length === 0) {
        return;
      }

      const newStep: HistoryStep = {
        patches,
        inversePatches,
        targetKey: getTargetKey(patches),
        timestamp: Date.now(),
      };

      historyPast.push(newStep);
      if (historyPast.length > MAX_HISTORY_DEPTH) {
        historyPast.shift();
      }
      historyFuture.length = 0;

      set({
        pastPatches: historyPast.map((s) => s.patches),
        futurePatches: [],
        canUndo: true,
        canRedo: false,
      });
    },

    abortTransaction: () => {
      if (!isTransactionActive || !activeTransactionBaseTree) {
        isTransactionActive = false;
        activeTransactionBaseTree = null;
        return;
      }

      const baseTree = activeTransactionBaseTree;
      isTransactionActive = false;
      activeTransactionBaseTree = null;

      saveCurrentTree(baseTree);
      set({ tree: baseTree });
    },

    batch: <T>(fn: () => T): T => {
      get().beginTransaction();
      try {
        const result = fn();
        get().commitTransaction();
        return result;
      } catch (err) {
        get().abortTransaction();
        throw err;
      }
    },

    updateTreeName: (name: string) => {
      get().setTree((prev) => ({ ...prev, name }));
    },

    updatePerson: (personId: string, updates: Partial<Person>) => {
      get().setTree((prev) => updatePersonInTree(prev, personId, updates));
      const collab = useCollabStore.getState();
      if (collab.isCloudTree && (collab.userPermission === 'owner' || collab.userPermission === 'editor')) {
        const currentTree = get().tree;
        cloudSyncBridge.queuePersonPatch(currentTree.id, personId, updates, {
          isSubcollection: currentTree.storageMode === 'subcollections',
        });
      }
    },

    updatePersonPosition: (personId, x, y, layoutStyle) => {
      get().setTree((prev) => {
        if (layoutStyle === 'horizontal') {
          return {
            ...prev,
            horizontalOverrides: {
              ...(prev.horizontalOverrides || {}),
              [personId]: { x, y },
            },
          };
        }
        return {
          ...prev,
          layoutOverrides: {
            ...(prev.layoutOverrides || {}),
            [personId]: { x, y },
          },
        };
      });
    },

    updateUnion: (unionId, updates) => {
      get().setTree((prev) => updateUnionInTree(prev, unionId, updates));
      const collab = useCollabStore.getState();
      if (collab.isCloudTree && (collab.userPermission === 'owner' || collab.userPermission === 'editor')) {
        cloudSyncBridge.queueUnionPatch(get().tree.id, unionId, updates);
      }
    },

    deleteUnion: (unionId: string) => {
      get().setTree((prev) => {
        const nextTree = { ...prev, unions: { ...prev.unions }, people: { ...prev.people } };
        delete nextTree.unions[unionId];
        // Clean up references in people
        Object.keys(nextTree.people).forEach((pId) => {
          const p = nextTree.people[pId];
          if (p.unionIds.includes(unionId)) {
            nextTree.people[pId] = {
              ...p,
              unionIds: p.unionIds.filter((id) => id !== unionId),
            };
          }
          if (p.parentUnionId === unionId) {
            nextTree.people[pId] = {
              ...p,
              parentUnionId: undefined,
            };
          }
        });
        return nextTree;
      });
    },

    deletePerson: (personId: string) => {
      get().setTree((prev) => deletePersonFromTree(prev, personId));
    },

    addPerson: (overrides = {}) => {
      const newPerson = createEmptyPerson(overrides);
      get().setTree((prev) => ({
        ...prev,
        people: {
          ...prev.people,
          [newPerson.id]: newPerson,
        },
      }));
      return newPerson;
    },

    addChild: (personId, preferredUnionId) => {
      let newId = '';
      get().setTree((prev) => {
        const res = addChildToPerson(prev, personId, preferredUnionId);
        newId = res.newChildId;
        return res.tree;
      });
      return newId;
    },

    addSibling: (personId) => {
      let newId = '';
      get().setTree((prev) => {
        const res = addSiblingToPerson(prev, personId);
        newId = res.newSiblingId;
        return res.tree;
      });
      return newId;
    },

    addPartner: (personId) => {
      let newId = '';
      get().setTree((prev) => {
        const res = addPartnerToPerson(prev, personId);
        newId = res.newPartnerId;
        return res.tree;
      });
      return newId;
    },

    addParent: (personId) => {
      let newId = '';
      get().setTree((prev) => {
        const res = addParentToPerson(prev, personId);
        newId = res.newParentId;
        return res.tree;
      });
      return newId;
    },

    linkChild: (sourcePersonId, targetPersonId, preferredUnionId) => {
      get().setTree((prev) => linkExistingChild(prev, sourcePersonId, targetPersonId, preferredUnionId));
    },

    linkSibling: (sourcePersonId, targetPersonId) => {
      get().setTree((prev) => linkExistingSibling(prev, sourcePersonId, targetPersonId));
    },

    linkPartner: (sourcePersonId, targetPersonId) => {
      get().setTree((prev) => linkExistingPartner(prev, sourcePersonId, targetPersonId));
    },

    linkParent: (sourcePersonId, targetPersonId) => {
      get().setTree((prev) => linkExistingParent(prev, sourcePersonId, targetPersonId));
    },

    unlinkPartnerAction: (personId, unionId) => {
      get().setTree((prev) => unlinkPartner(prev, personId, unionId));
    },

    unlinkChildAction: (childPersonId) => {
      get().setTree((prev) => unlinkChild(prev, childPersonId));
    },

    unlinkParentFromChildAction: (childPersonId, parentPersonId) => {
      get().setTree((prev) => unlinkParentFromChild(prev, childPersonId, parentPersonId));
    },

    resetLayout: () => {
      useCanvasStore.getState().clearLayoutOverrides();
      get().setTree((prev) => clearManualPositions(prev));
    },

    makeCopy: () => {
      const current = get().tree;
      const newId = generateId('tree');
      const now = new Date().toISOString();
      const copy: TreeData = {
        ...current,
        id: newId,
        name: `${current.name || 'Family Tree'} (Copy)`,
        createdAt: now,
        updatedAt: now,
      };
      delete (copy as any).ownerId;
      delete (copy as any).ownerEmail;
      delete (copy as any).ownerDisplayName;
      delete (copy as any).ownerPhotoURL;
      delete (copy as any).sharedWith;
      delete (copy as any).sharedEmails;
      get().resetHistory(copy);
      return copy;
    },

    attachDocument: (personId, doc) => {
      get().setTree((prev) => attachDocumentToPerson(prev, personId, doc));
      const collab = useCollabStore.getState();
      if (collab.isCloudTree && (collab.userPermission === 'owner' || collab.userPermission === 'editor')) {
        const currentTree = get().tree;
        const updatedDocs = currentTree.people[personId]?.documents;
        cloudSyncBridge.queuePersonPatch(
          currentTree.id,
          personId,
          { documents: updatedDocs },
          { isSubcollection: currentTree.storageMode === 'subcollections' }
        );
      }
    },

    removeDocument: (personId, documentId) => {
      get().setTree((prev) => removeDocumentFromPerson(prev, personId, documentId));
      const collab = useCollabStore.getState();
      if (collab.isCloudTree && (collab.userPermission === 'owner' || collab.userPermission === 'editor')) {
        const currentTree = get().tree;
        const updatedDocs = currentTree.people[personId]?.documents;
        cloudSyncBridge.queuePersonPatch(
          currentTree.id,
          personId,
          { documents: updatedDocs },
          { isSubcollection: currentTree.storageMode === 'subcollections' }
        );
      }
    },

    setGoogleDriveConfig: (config) => {
      get().setTree((prev) => updateTreeGoogleDriveConfig(prev, config));
    },
  };
});
