import React from 'react';
import confetti from 'canvas-confetti';
import type { TreeData } from '../../types/tree';
import { useAuth } from '../../hooks/useAuth';
import { useTreeStore } from '../../stores/useTreeStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { useModalStore } from '../../stores/useModalStore';

import { EdgeCaseModal } from './EdgeCaseModal';
import { AddRelationshipModal } from './AddRelationshipModal';
import { EditUnionModal } from './EditUnionModal';
import { TreeManagerModal } from './TreeManagerModal';
import { CreateTreeFromSelectionModal, type CreateTreeOptions } from './CreateTreeFromSelectionModal';
import { LinkExistingTreeModal } from './LinkExistingTreeModal';
import { ShareTreeModal } from './ShareTreeModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { SunburstModal } from './SunburstModal';

export interface TreeModalsProps {
  onSwitchTree: (
    newTree: TreeData,
    isCloud?: boolean,
    focusPersonId?: string | null
  ) => void;
  onSelectPreset: (presetKey: 'double_in_law' | 'divorce' | 'royal' | 'blank') => void;
  onCreateTreeFromSelection: (options: CreateTreeOptions) => void;
  onLinkTrees: (
    targetTreeId: string,
    targetPersonId: string,
    isTargetCloud?: boolean,
    preloadedTargetTree?: TreeData
  ) => void;
  onTreeUpdatedInShare?: (updatedCloudTree: TreeData) => void;
}

export const TreeModals: React.FC<TreeModalsProps> = ({
  onSwitchTree,
  onSelectPreset,
  onCreateTreeFromSelection,
  onLinkTrees,
  onTreeUpdatedInShare,
}) => {
  const { user } = useAuth();

  // Stores
  const tree = useTreeStore((s) => s.tree);
  const updatePerson = useTreeStore((s) => s.updatePerson);
  const updateUnion = useTreeStore((s) => s.updateUnion);
  const deleteUnion = useTreeStore((s) => s.deleteUnion);
  const addChild = useTreeStore((s) => s.addChild);
  const addSibling = useTreeStore((s) => s.addSibling);
  const addPartner = useTreeStore((s) => s.addPartner);
  const addParent = useTreeStore((s) => s.addParent);
  const linkChild = useTreeStore((s) => s.linkChild);
  const linkSibling = useTreeStore((s) => s.linkSibling);
  const linkPartner = useTreeStore((s) => s.linkPartner);
  const linkParent = useTreeStore((s) => s.linkParent);

  const selectedPersonId = useCanvasStore((s) => s.selectedPersonId);
  const selectedPersonIds = useCanvasStore((s) => s.selectedPersonIds);
  const selectedUnionId = useCanvasStore((s) => s.selectedUnionId);
  const selectPerson = useCanvasStore((s) => s.selectPerson);
  const setSelectedUnionId = useCanvasStore((s) => s.setSelectedUnionId);

  const isCloudTree = useCollabStore((s) => s.isCloudTree);
  const userPermission = useCollabStore((s) => s.userPermission);
  const isReadOnly = userPermission === 'viewer';

  // Modal store
  const isEdgeCaseModalOpen = useModalStore((s) => s.isEdgeCaseModalOpen);
  const closeEdgeCaseModal = useModalStore((s) => s.closeEdgeCaseModal);

  const isTreeManagerOpen = useModalStore((s) => s.isTreeManagerOpen);
  const closeTreeManager = useModalStore((s) => s.closeTreeManager);
  const openShareModal = useModalStore((s) => s.openShareModal);

  const isCreateTreeModalOpen = useModalStore((s) => s.isCreateTreeModalOpen);
  const closeCreateTreeModal = useModalStore((s) => s.closeCreateTreeModal);

  const isLinkTreeModalOpen = useModalStore((s) => s.isLinkTreeModalOpen);
  const closeLinkTreeModal = useModalStore((s) => s.closeLinkTreeModal);
  const personToLink = useModalStore((s) => s.personToLink);

  const isShareModalOpen = useModalStore((s) => s.isShareModalOpen);
  const closeShareModal = useModalStore((s) => s.closeShareModal);

  const previewDoc = useModalStore((s) => s.previewDoc);
  const closePreviewDoc = useModalStore((s) => s.closePreviewDoc);

  const isSunburstModalOpen = useModalStore((s) => s.isSunburstModalOpen);
  const closeSunburstModal = useModalStore((s) => s.closeSunburstModal);
  const sunburstPersonId = useModalStore((s) => s.sunburstPersonId);

  const relModal = useModalStore((s) => s.relModal);
  const closeRelationshipModal = useModalStore((s) => s.closeRelationshipModal);
  const openRelationshipModal = useModalStore((s) => s.openRelationshipModal);

  // Relationship modal handlers
  const handleCreateNewRelation = () => {
    const { sourcePersonId, relationType, preferredUnionId } = relModal;
    if (!sourcePersonId) return;

    let newId = '';
    if (relationType === 'child') {
      newId = addChild(sourcePersonId, preferredUnionId);
    } else if (relationType === 'sibling') {
      newId = addSibling(sourcePersonId);
    } else if (relationType === 'partner') {
      newId = addPartner(sourcePersonId);
    } else if (relationType === 'parent') {
      newId = addParent(sourcePersonId);
    }

    if (newId) {
      selectPerson(newId);
    }
    closeRelationshipModal();
  };

  const handleLinkExistingRelation = (targetPersonId: string) => {
    const { sourcePersonId, relationType, preferredUnionId } = relModal;
    if (!sourcePersonId || !targetPersonId) return;

    if (relationType === 'child') {
      linkChild(sourcePersonId, targetPersonId, preferredUnionId);
    } else if (relationType === 'sibling') {
      linkSibling(sourcePersonId, targetPersonId);
    } else if (relationType === 'partner') {
      linkPartner(sourcePersonId, targetPersonId);
    } else if (relationType === 'parent') {
      linkParent(sourcePersonId, targetPersonId);
    }

    selectPerson(targetPersonId);
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    closeRelationshipModal();
  };

  const handleAddChildToUnion = (unionId: string) => {
    const union = tree.unions[unionId];
    if (!union) return;
    const firstPartner = union.partnerIds[0];
    if (firstPartner) {
      openRelationshipModal(firstPartner, 'child', unionId);
    }
  };

  const handleTreeUpdatedInShare = onTreeUpdatedInShare || ((updatedCloudTree: TreeData) => {
    useTreeStore.getState().resetHistory(updatedCloudTree);
    useCollabStore.getState().setIsCloudTree(true);
    useCollabStore.getState().setUserPermission('owner');
    useCollabStore.getState().setCloudSyncStatus('synced');
  });

  return (
    <>
      {/* Tree Manager Modal */}
      <TreeManagerModal
        isOpen={isTreeManagerOpen}
        onClose={closeTreeManager}
        currentTreeId={tree.id}
        onSwitchTree={onSwitchTree}
        onOpenShareModal={openShareModal}
      />

      {/* Share Tree Modal */}
      <ShareTreeModal
        isOpen={isShareModalOpen}
        onClose={closeShareModal}
        tree={tree}
        isCloudTree={isCloudTree}
        onTreeUpdated={handleTreeUpdatedInShare}
      />

      {/* Edge Case Preset Showcase Modal */}
      <EdgeCaseModal
        isOpen={isEdgeCaseModalOpen}
        onClose={closeEdgeCaseModal}
        onLoadDemo={() => {
          closeEdgeCaseModal();
          onSelectPreset('double_in_law');
        }}
      />

      {/* Add / Link Relationship Modal */}
      <AddRelationshipModal
        isOpen={relModal.isOpen}
        onClose={closeRelationshipModal}
        tree={tree}
        sourcePersonId={relModal.sourcePersonId}
        relationType={relModal.relationType}
        onCreateNew={handleCreateNewRelation}
        onLinkExisting={handleLinkExistingRelation}
      />

      {/* Edit Union / Partnership Modal */}
      <EditUnionModal
        isOpen={Boolean(selectedUnionId)}
        onClose={() => setSelectedUnionId(null)}
        tree={tree}
        unionId={selectedUnionId}
        onUpdateUnion={updateUnion}
        onDeleteUnion={deleteUnion}
        onAddChildToUnion={handleAddChildToUnion}
        onSelectPerson={(id) => {
          selectPerson(id);
          setSelectedUnionId(null);
        }}
      />

      {/* Create Tree from Selection Modal */}
      {isCreateTreeModalOpen && (
        <CreateTreeFromSelectionModal
          isOpen={isCreateTreeModalOpen}
          onClose={closeCreateTreeModal}
          tree={tree}
          selectedPersonIds={Array.from(selectedPersonIds)}
          isCloudTree={isCloudTree && Boolean(user)}
          onCreateTree={(options) => {
            closeCreateTreeModal();
            onCreateTreeFromSelection(options);
          }}
        />
      )}

      {/* Link Existing Tree Modal */}
      {isLinkTreeModalOpen && personToLink && (
        <LinkExistingTreeModal
          isOpen={isLinkTreeModalOpen}
          onClose={closeLinkTreeModal}
          currentTree={tree}
          currentPerson={personToLink}
          onLinkTrees={(targetTreeId, targetPersonId, isTargetCloud, preloadedTargetTree) => {
            closeLinkTreeModal();
            onLinkTrees(targetTreeId, targetPersonId, isTargetCloud, preloadedTargetTree);
          }}
        />
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={Boolean(previewDoc)}
          onClose={closePreviewDoc}
          document={previewDoc.doc}
          personName={previewDoc.personName}
          isReadOnly={isReadOnly}
          onDelete={(docId) => {
            if (selectedPersonId) {
              const person = tree.people[selectedPersonId];
              if (person && person.documents) {
                updatePerson(selectedPersonId, {
                  documents: person.documents.filter((d) => d.id !== docId),
                });
              }
            }
          }}
        />
      )}

      {/* Ancestor Sunburst Chart Modal */}
      {isSunburstModalOpen && (
        <SunburstModal
          isOpen={isSunburstModalOpen}
          onClose={closeSunburstModal}
          tree={tree}
          initialPersonId={sunburstPersonId || selectedPersonId}
          onSelectPersonInTree={selectPerson}
        />
      )}
    </>
  );
};
