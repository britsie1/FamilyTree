import { useCallback } from 'react';
import confetti from 'canvas-confetti';
import type { Person, TreeData, TreeLink } from '../types/tree';
import type { CreateTreeOptions } from '../components/Modal/CreateTreeFromSelectionModal';
import {
  splitBranchToNewTree,
  removeTreeLink,
  linkPeopleAcrossTrees,
} from '../services/treeOperations';
import {
  loadTreeById,
  saveCurrentTree,
  saveTreeWithoutActivating,
} from '../services/storage';
import {
  getCloudTree,
  saveTreeToCloud,
  updateCloudTreeData,
} from '../services/firestoreService';
import { useAuth } from './useAuth';
import { useTreeStore } from '../stores/useTreeStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useCollabStore } from '../stores/useCollabStore';
import { useModalStore } from '../stores/useModalStore';

export interface UseTreeLinkingOptions {
  onSwitchTree: (
    newTree: TreeData,
    isCloud?: boolean,
    focusPersonId?: string | null
  ) => void;
}

export function useTreeLinking({ onSwitchTree }: UseTreeLinkingOptions) {
  const { user } = useAuth();

  const tree = useTreeStore((s) => s.tree);
  const setTree = useTreeStore((s) => s.setTree);

  const selectedPersonId = useCanvasStore((s) => s.selectedPersonId);
  const selectedPersonIds = useCanvasStore((s) => s.selectedPersonIds);
  const selectPerson = useCanvasStore((s) => s.selectPerson);

  const isCloudTree = useCollabStore((s) => s.isCloudTree);

  const personToLink = useModalStore((s) => s.personToLink);
  const openLinkTreeModal = useModalStore((s) => s.openLinkTreeModal);

  const handleOpenTreeLink = useCallback(
    async (_person: Person, link: TreeLink) => {
      let targetTree: TreeData | null = null;
      let isCloud = Boolean(link.isCloud);

      // 1. If flagged as cloud or user is logged in, try loading cloud tree from Firestore
      if (isCloud || user) {
        try {
          const cloudTree = await getCloudTree(link.treeId);
          if (cloudTree) {
            targetTree = cloudTree;
            isCloud = true;
          }
        } catch (err) {
          console.warn('Could not fetch cloud tree for link:', err);
        }
      }

      // 2. If not found in cloud, check local storage
      if (!targetTree) {
        targetTree = loadTreeById(link.treeId);
      }

      // 3. If targetTree has ownerId (cloud metadata), it is a cloud tree
      if (targetTree && (targetTree as any).ownerId) {
        isCloud = true;
      }

      if (targetTree) {
        onSwitchTree(targetTree, isCloud, link.personId);
        confetti({ particleCount: 35, spread: 45, origin: { y: 0.65 } });
      } else {
        alert(`Linked family tree "${link.treeName}" could not be found.`);
      }
    },
    [onSwitchTree, user]
  );

  const handleOpenLinkModal = useCallback(
    (person?: Person | null) => {
      const target = person || (selectedPersonId ? tree.people[selectedPersonId] : null);
      if (target) {
        openLinkTreeModal(target);
      }
    },
    [selectedPersonId, tree.people, openLinkTreeModal]
  );

  const handleLinkTrees = useCallback(
    async (
      targetTreeId: string,
      targetPersonId: string,
      isTargetCloud?: boolean,
      preloadedTargetTree?: TreeData
    ) => {
      if (!personToLink) return;

      let targetTree = preloadedTargetTree || loadTreeById(targetTreeId);
      let isCloudTarget = isTargetCloud ?? Boolean((targetTree as any)?.ownerId);

      if (!targetTree && (isCloudTarget || user)) {
        try {
          const cloudTree = await getCloudTree(targetTreeId);
          if (cloudTree) {
            targetTree = cloudTree;
            isCloudTarget = true;
          }
        } catch (err) {
          console.warn('Could not fetch cloud tree for linking:', err);
        }
      }

      if (!targetTree) {
        alert('Could not locate the target tree to establish link.');
        return;
      }

      const isCurrentCloud = isCloudTree && Boolean(user);

      const { updatedTreeA, updatedTreeB } = linkPeopleAcrossTrees(
        tree,
        personToLink.id,
        targetTree,
        targetPersonId,
        {
          isCloudA: isCurrentCloud,
          isCloudB: isCloudTarget,
        }
      );

      // Persist target tree to cloud if cloud target
      if (isCloudTarget && user) {
        try {
          await updateCloudTreeData(updatedTreeB);
        } catch (err) {
          console.warn('Could not update cloud target tree:', err);
        }
      }
      saveTreeWithoutActivating(updatedTreeB);

      // Persist current tree
      setTree(updatedTreeA);
      selectPerson(personToLink.id);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    },
    [personToLink, tree, isCloudTree, user, setTree, selectPerson]
  );

  const handleRemoveTreeLink = useCallback(
    async (personId: string, targetTreeId: string) => {
      const updated = removeTreeLink(tree, personId, targetTreeId);
      setTree(updated);

      let targetTree = loadTreeById(targetTreeId);
      let isCloudTarget = false;
      if (!targetTree && user) {
        try {
          targetTree = await getCloudTree(targetTreeId);
          if (targetTree) isCloudTarget = true;
        } catch (err) {
          console.warn('Could not fetch cloud tree to remove reverse link:', err);
        }
      }

      if (targetTree) {
        let modified = false;
        for (const p of Object.values(targetTree.people)) {
          if (p.linkedTrees?.some((l) => l.treeId === tree.id)) {
            targetTree.people[p.id] = {
              ...p,
              linkedTrees: p.linkedTrees.filter((l) => l.treeId !== tree.id),
            };
            modified = true;
          }
        }
        if (modified) {
          if ((isCloudTarget || (targetTree as any).ownerId) && user) {
            try {
              await updateCloudTreeData(targetTree);
            } catch (err) {
              console.warn('Could not update reverse link in cloud:', err);
            }
          }
          saveTreeWithoutActivating(targetTree);
        }
      }
    },
    [tree, setTree, user]
  );

  const handleCreateTreeFromSelection = useCallback(
    async (options: CreateTreeOptions) => {
      const selectedArray = Array.from(selectedPersonIds);
      if (selectedArray.length === 0) return;

      const isCurrentCloud = isCloudTree && Boolean(user);

      const { newTree, updatedSourceTree, bridgePersonId } = splitBranchToNewTree(
        tree,
        selectedArray,
        options.name,
        {
          bridgePersonId: options.bridgePersonId,
          removeMovedFromSource: options.removeMovedFromSource,
          linkTrees: options.linkTrees,
          isCloud: isCurrentCloud,
        }
      );

      let targetNewTree = newTree;
      let targetSourceTree = updatedSourceTree;

      // If working on a cloud tree and authenticated, save new branch to cloud and update source in cloud
      if (isCurrentCloud && user) {
        try {
          const savedCloudNew = await saveTreeToCloud(newTree, user);
          targetNewTree = savedCloudNew;
          await updateCloudTreeData(updatedSourceTree);
        } catch (err) {
          console.error('Failed to sync newly split branch to cloud:', err);
        }
      }

      // Persist the updated source tree
      saveCurrentTree(targetSourceTree);

      if (options.switchImmediately) {
        saveCurrentTree(targetNewTree);
        onSwitchTree(targetNewTree, isCurrentCloud, bridgePersonId);
        confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
      } else {
        saveTreeWithoutActivating(targetNewTree);
        setTree(targetSourceTree);
        selectPerson(bridgePersonId);
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
      }
    },
    [selectedPersonIds, tree, isCloudTree, user, onSwitchTree, setTree, selectPerson]
  );

  return {
    handleOpenTreeLink,
    handleOpenLinkModal,
    handleLinkTrees,
    handleRemoveTreeLink,
    handleCreateTreeFromSelection,
  };
}
