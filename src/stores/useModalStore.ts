import { create } from 'zustand';
import type { Person, PersonDocument } from '../types/tree';
import type { RelationType } from '../components/Modal/AddRelationshipModal';

export type ActiveModal =
  | { type: 'edge_case' }
  | { type: 'tree_manager' }
  | { type: 'create_tree' }
  | { type: 'link_tree'; person: Person }
  | { type: 'share' }
  | { type: 'document_preview'; doc: PersonDocument; personName: string }
  | {
      type: 'relationship';
      sourcePersonId: string;
      relationType: RelationType;
      preferredUnionId?: string;
    }
  | { type: 'sunburst'; personId: string }
  | { type: 'tree_statistics' }
  | null;

export interface ModalStoreState {
  activeModal: ActiveModal;

  // Convenience state flags & payloads for direct component binding
  isStatisticsModalOpen: boolean;
  isEdgeCaseModalOpen: boolean;
  isTreeManagerOpen: boolean;
  isCreateTreeModalOpen: boolean;
  isLinkTreeModalOpen: boolean;
  personToLink: Person | null;
  isShareModalOpen: boolean;
  previewDoc: { doc: PersonDocument; personName: string } | null;
  isSunburstModalOpen: boolean;
  sunburstPersonId: string | null;
  relModal: {
    isOpen: boolean;
    sourcePersonId: string | null;
    relationType: RelationType;
    preferredUnionId?: string;
  };

  // Generic modal actions
  openModal: (modal: Exclude<ActiveModal, null>) => void;
  closeModal: () => void;
  closeAllModals: () => void;

  // Ergonomic helper actions
  openSunburstModal: (personId: string) => void;
  closeSunburstModal: () => void;

  openStatisticsModal: () => void;
  closeStatisticsModal: () => void;

  // Ergonomic helper actions
  openEdgeCaseModal: () => void;
  closeEdgeCaseModal: () => void;

  openTreeManager: () => void;
  closeTreeManager: () => void;

  openCreateTreeModal: () => void;
  closeCreateTreeModal: () => void;

  openLinkTreeModal: (person: Person) => void;
  closeLinkTreeModal: () => void;

  openShareModal: () => void;
  closeShareModal: () => void;

  openPreviewDoc: (doc: PersonDocument, personName: string) => void;
  closePreviewDoc: () => void;

  openRelationshipModal: (
    sourcePersonId: string,
    relationType: RelationType,
    preferredUnionId?: string
  ) => void;
  closeRelationshipModal: () => void;
}

const initialModalFlags = {
  isStatisticsModalOpen: false,
  isEdgeCaseModalOpen: false,
  isTreeManagerOpen: false,
  isCreateTreeModalOpen: false,
  isLinkTreeModalOpen: false,
  personToLink: null,
  isShareModalOpen: false,
  previewDoc: null,
  isSunburstModalOpen: false,
  sunburstPersonId: null,
  relModal: {
    isOpen: false,
    sourcePersonId: null,
    relationType: 'child' as RelationType,
    preferredUnionId: undefined,
  },
};

export const useModalStore = create<ModalStoreState>((set) => ({
  activeModal: null,
  ...initialModalFlags,

  openModal: (modal) => {
    switch (modal.type) {
      case 'tree_statistics':
        set({
          activeModal: modal,
          ...initialModalFlags,
          isStatisticsModalOpen: true,
        });
        break;
      case 'sunburst':
        set({
          activeModal: modal,
          ...initialModalFlags,
          isSunburstModalOpen: true,
          sunburstPersonId: modal.personId,
        });
        break;
      case 'edge_case':
        set({
          activeModal: modal,
          ...initialModalFlags,
          isEdgeCaseModalOpen: true,
        });
        break;
      case 'tree_manager':
        set({
          activeModal: modal,
          ...initialModalFlags,
          isTreeManagerOpen: true,
        });
        break;
      case 'create_tree':
        set({
          activeModal: modal,
          ...initialModalFlags,
          isCreateTreeModalOpen: true,
        });
        break;
      case 'link_tree':
        set({
          activeModal: modal,
          ...initialModalFlags,
          isLinkTreeModalOpen: true,
          personToLink: modal.person,
        });
        break;
      case 'share':
        set({
          activeModal: modal,
          ...initialModalFlags,
          isShareModalOpen: true,
        });
        break;
      case 'document_preview':
        set({
          activeModal: modal,
          ...initialModalFlags,
          previewDoc: { doc: modal.doc, personName: modal.personName },
        });
        break;
      case 'relationship':
        set({
          activeModal: modal,
          ...initialModalFlags,
          relModal: {
            isOpen: true,
            sourcePersonId: modal.sourcePersonId,
            relationType: modal.relationType,
            preferredUnionId: modal.preferredUnionId,
          },
        });
        break;
    }
  },

  closeModal: () => {
    set({
      activeModal: null,
      ...initialModalFlags,
    });
  },

  closeAllModals: () => {
    set({
      activeModal: null,
      ...initialModalFlags,
    });
  },

  openSunburstModal: (personId: string) => {
    set({
      activeModal: { type: 'sunburst', personId },
      isSunburstModalOpen: true,
      sunburstPersonId: personId,
    });
  },
  closeSunburstModal: () => {
    set((state) => ({
      activeModal: state.activeModal?.type === 'sunburst' ? null : state.activeModal,
      isSunburstModalOpen: false,
      sunburstPersonId: null,
    }));
  },

  openStatisticsModal: () => {
    set({
      activeModal: { type: 'tree_statistics' },
      isStatisticsModalOpen: true,
    });
  },
  closeStatisticsModal: () => {
    set((state) => ({
      activeModal: state.activeModal?.type === 'tree_statistics' ? null : state.activeModal,
      isStatisticsModalOpen: false,
    }));
  },

  openEdgeCaseModal: () => {
    set({
      activeModal: { type: 'edge_case' },
      isEdgeCaseModalOpen: true,
    });
  },
  closeEdgeCaseModal: () => {
    set((state) => ({
      activeModal: state.activeModal?.type === 'edge_case' ? null : state.activeModal,
      isEdgeCaseModalOpen: false,
    }));
  },

  openTreeManager: () => {
    set({
      activeModal: { type: 'tree_manager' },
      isTreeManagerOpen: true,
    });
  },
  closeTreeManager: () => {
    set((state) => ({
      activeModal: state.activeModal?.type === 'tree_manager' ? null : state.activeModal,
      isTreeManagerOpen: false,
    }));
  },

  openCreateTreeModal: () => {
    set({
      activeModal: { type: 'create_tree' },
      isCreateTreeModalOpen: true,
    });
  },
  closeCreateTreeModal: () => {
    set((state) => ({
      activeModal: state.activeModal?.type === 'create_tree' ? null : state.activeModal,
      isCreateTreeModalOpen: false,
    }));
  },

  openLinkTreeModal: (person: Person) => {
    set({
      activeModal: { type: 'link_tree', person },
      isLinkTreeModalOpen: true,
      personToLink: person,
    });
  },
  closeLinkTreeModal: () => {
    set((state) => ({
      activeModal: state.activeModal?.type === 'link_tree' ? null : state.activeModal,
      isLinkTreeModalOpen: false,
      personToLink: null,
    }));
  },

  openShareModal: () => {
    set({
      activeModal: { type: 'share' },
      isShareModalOpen: true,
    });
  },
  closeShareModal: () => {
    set((state) => ({
      activeModal: state.activeModal?.type === 'share' ? null : state.activeModal,
      isShareModalOpen: false,
    }));
  },

  openPreviewDoc: (doc: PersonDocument, personName: string) => {
    set({
      activeModal: { type: 'document_preview', doc, personName },
      previewDoc: { doc, personName },
    });
  },
  closePreviewDoc: () => {
    set((state) => ({
      activeModal: state.activeModal?.type === 'document_preview' ? null : state.activeModal,
      previewDoc: null,
    }));
  },

  openRelationshipModal: (sourcePersonId, relationType, preferredUnionId) => {
    set({
      activeModal: { type: 'relationship', sourcePersonId, relationType, preferredUnionId },
      relModal: {
        isOpen: true,
        sourcePersonId,
        relationType,
        preferredUnionId,
      },
    });
  },
  closeRelationshipModal: () => {
    set((state) => ({
      activeModal: state.activeModal?.type === 'relationship' ? null : state.activeModal,
      relModal: {
        isOpen: false,
        sourcePersonId: null,
        relationType: 'child',
        preferredUnionId: undefined,
      },
    }));
  },
}));
