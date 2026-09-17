import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useModalStore } from '../src/stores/useModalStore.ts';
import type { Person, PersonDocument } from '../src/types/tree.ts';

describe('useModalStore', () => {
  beforeEach(() => {
    useModalStore.getState().closeAllModals();
  });

  it('initializes with all modals closed and activeModal as null', () => {
    const state = useModalStore.getState();
    assert.strictEqual(state.activeModal, null);
    assert.strictEqual(state.isEdgeCaseModalOpen, false);
    assert.strictEqual(state.isTreeManagerOpen, false);
    assert.strictEqual(state.isCreateTreeModalOpen, false);
    assert.strictEqual(state.isLinkTreeModalOpen, false);
    assert.strictEqual(state.personToLink, null);
    assert.strictEqual(state.isShareModalOpen, false);
    assert.strictEqual(state.previewDoc, null);
    assert.strictEqual(state.relModal.isOpen, false);
  });

  it('opens and closes edge case modal', () => {
    useModalStore.getState().openEdgeCaseModal();
    assert.strictEqual(useModalStore.getState().isEdgeCaseModalOpen, true);
    assert.deepStrictEqual(useModalStore.getState().activeModal, { type: 'edge_case' });

    useModalStore.getState().closeEdgeCaseModal();
    assert.strictEqual(useModalStore.getState().isEdgeCaseModalOpen, false);
    assert.strictEqual(useModalStore.getState().activeModal, null);
  });

  it('opens and closes tree manager modal', () => {
    useModalStore.getState().openTreeManager();
    assert.strictEqual(useModalStore.getState().isTreeManagerOpen, true);
    assert.deepStrictEqual(useModalStore.getState().activeModal, { type: 'tree_manager' });

    useModalStore.getState().closeTreeManager();
    assert.strictEqual(useModalStore.getState().isTreeManagerOpen, false);
    assert.strictEqual(useModalStore.getState().activeModal, null);
  });

  it('opens and closes link tree modal with target person', () => {
    const mockPerson = { id: 'p1', firstName: 'John', lastName: 'Doe', gender: 'male', unionIds: [] } as Person;
    useModalStore.getState().openLinkTreeModal(mockPerson);

    assert.strictEqual(useModalStore.getState().isLinkTreeModalOpen, true);
    assert.strictEqual(useModalStore.getState().personToLink?.id, 'p1');
    assert.strictEqual(useModalStore.getState().activeModal?.type, 'link_tree');

    useModalStore.getState().closeLinkTreeModal();
    assert.strictEqual(useModalStore.getState().isLinkTreeModalOpen, false);
    assert.strictEqual(useModalStore.getState().personToLink, null);
    assert.strictEqual(useModalStore.getState().activeModal, null);
  });

  it('opens and closes document preview modal with document data', () => {
    const mockDoc: PersonDocument = {
      id: 'doc-1',
      title: 'Birth Certificate',
      type: 'certificate',
      url: 'https://example.com/doc.pdf',
      createdAt: '2026-01-01',
    };
    useModalStore.getState().openPreviewDoc(mockDoc, 'John Doe');

    assert.strictEqual(useModalStore.getState().previewDoc?.doc.id, 'doc-1');
    assert.strictEqual(useModalStore.getState().previewDoc?.personName, 'John Doe');
    assert.strictEqual(useModalStore.getState().activeModal?.type, 'document_preview');

    useModalStore.getState().closePreviewDoc();
    assert.strictEqual(useModalStore.getState().previewDoc, null);
    assert.strictEqual(useModalStore.getState().activeModal, null);
  });

  it('opens and closes relationship modal with payload', () => {
    useModalStore.getState().openRelationshipModal('person-1', 'partner', 'u-1');

    const state = useModalStore.getState();
    assert.strictEqual(state.relModal.isOpen, true);
    assert.strictEqual(state.relModal.sourcePersonId, 'person-1');
    assert.strictEqual(state.relModal.relationType, 'partner');
    assert.strictEqual(state.relModal.preferredUnionId, 'u-1');
    assert.strictEqual(state.activeModal?.type, 'relationship');

    useModalStore.getState().closeRelationshipModal();
    assert.strictEqual(useModalStore.getState().relModal.isOpen, false);
    assert.strictEqual(useModalStore.getState().relModal.sourcePersonId, null);
    assert.strictEqual(useModalStore.getState().activeModal, null);
  });

  it('closeAllModals resets all open states at once', () => {
    useModalStore.getState().openShareModal();
    assert.strictEqual(useModalStore.getState().isShareModalOpen, true);

    useModalStore.getState().closeAllModals();
    assert.strictEqual(useModalStore.getState().isShareModalOpen, false);
    assert.strictEqual(useModalStore.getState().activeModal, null);
  });
});
