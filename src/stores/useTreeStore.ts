import { create } from 'zustand';
import type { TreeData, Person, UnionType } from '../types/tree';
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
} from '../services/treeOperations';

const MAX_HISTORY_DEPTH = 50;

export interface TreeStoreState {
  tree: TreeData;
  past: TreeData[];
  future: TreeData[];
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
}

const initialTree = loadCurrentTree();

export const useTreeStore = create<TreeStoreState>((set, get) => ({
  tree: initialTree,
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  setTree: (nextTreeOrUpdater, recordHistory = true) => {
    set((state) => {
      const nextTree =
        typeof nextTreeOrUpdater === 'function'
          ? nextTreeOrUpdater(state.tree)
          : nextTreeOrUpdater;

      if (nextTree === state.tree) {
        return state;
      }

      saveCurrentTree(nextTree);

      if (!recordHistory) {
        return { tree: nextTree };
      }

      const nextPast = [...state.past, state.tree];
      if (nextPast.length > MAX_HISTORY_DEPTH) {
        nextPast.shift();
      }

      return {
        tree: nextTree,
        past: nextPast,
        future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  undo: () => {
    set((state) => {
      if (state.past.length === 0) return state;

      const previous = state.past[state.past.length - 1];
      const nextPast = state.past.slice(0, state.past.length - 1);
      const nextFuture = [state.tree, ...state.future];

      saveCurrentTree(previous);

      return {
        tree: previous,
        past: nextPast,
        future: nextFuture,
        canUndo: nextPast.length > 0,
        canRedo: true,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.future.length === 0) return state;

      const next = state.future[0];
      const nextFuture = state.future.slice(1);
      const nextPast = [...state.past, state.tree];

      saveCurrentTree(next);

      return {
        tree: next,
        past: nextPast,
        future: nextFuture,
        canUndo: true,
        canRedo: nextFuture.length > 0,
      };
    });
  },

  resetHistory: (newTree: TreeData) => {
    saveCurrentTree(newTree);
    set({
      tree: newTree,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  },

  updateTreeName: (name: string) => {
    get().setTree((prev) => ({ ...prev, name }));
  },

  updatePerson: (personId: string, updates: Partial<Person>) => {
    get().setTree((prev) => updatePersonInTree(prev, personId, updates));
  },

  updatePersonPosition: (personId, x, y, layoutStyle) => {
    get().setTree((prev) => {
      if (layoutStyle === 'horizontal') {
        return updatePersonInTree(prev, personId, { horizontalX: x, horizontalY: y });
      }
      return updatePersonInTree(prev, personId, { x, y });
    });
  },

  updateUnion: (unionId, updates) => {
    get().setTree((prev) => updateUnionInTree(prev, unionId, updates));
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
}));
