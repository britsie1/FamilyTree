import { create } from 'zustand';
import type { LayoutStyle, LayoutOverrides } from '../types/tree';

export interface CanvasStoreState {
  // Viewport
  zoom: number;
  pan: { x: number; y: number };
  setZoom: (zoomOrUpdater: number | ((prev: number) => number)) => void;
  setPan: (
    panOrUpdater:
      | { x: number; y: number }
      | ((prev: { x: number; y: number }) => { x: number; y: number })
  ) => void;

  // Layout mode
  layoutStyle: LayoutStyle;
  groupByFamily: boolean;
  adjustSpacing: boolean;
  setLayoutStyle: (style: LayoutStyle) => void;
  toggleLayoutStyle: () => void;
  toggleGroupByFamily: () => void;
  toggleAdjustSpacing: () => void;

  // Selection & Focus
  selectedPersonId: string | null;
  selectedPersonIds: Set<string>;
  comparisonPersonId: string | null;
  selectedUnionId: string | null;
  focusPersonId: string | null;
  collapsedPersonIds: Set<string>;

  selectPerson: (personId: string | null, event?: React.MouseEvent) => void;
  multiSelectPeople: (personIds: string[], append?: boolean) => void;
  setComparisonPersonId: (id: string | null) => void;
  swapComparison: () => void;
  setSelectedUnionId: (id: string | null) => void;
  toggleFocus: (personId: string) => void;
  clearFocus: () => void;
  toggleCollapse: (personId: string) => void;
  clearSelection: () => void;

  // MiniMap Radar Navigator
  isMiniMapOpen: boolean;
  toggleMiniMap: () => void;
  setIsMiniMapOpen: (isOpen: boolean) => void;

  // Transient drag state (isolated from canonical tree mutations)
  draggingPersonId: string | null;
  dragOffset: { x: number; y: number } | null;
  setTransientDrag: (personId: string | null, offset: { x: number; y: number } | null) => void;

  // Presentation layout overrides
  layoutOverrides: LayoutOverrides;
  updatePersonPosition: (personId: string, x: number, y: number) => void;
  setLayoutOverrides: (
    overrides: LayoutOverrides | ((prev: LayoutOverrides) => LayoutOverrides)
  ) => void;
  clearLayoutOverrides: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  // Viewport
  zoom: 0.9,
  pan: { x: 400, y: 150 },
  isMiniMapOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  toggleMiniMap: () => {
    set((state) => ({ isMiniMapOpen: !state.isMiniMapOpen }));
  },
  setIsMiniMapOpen: (isMiniMapOpen) => {
    set({ isMiniMapOpen });
  },
  setZoom: (zoomOrUpdater) => {
    set((state) => ({
      zoom: typeof zoomOrUpdater === 'function' ? zoomOrUpdater(state.zoom) : zoomOrUpdater,
    }));
  },
  setPan: (panOrUpdater) => {
    set((state) => ({
      pan: typeof panOrUpdater === 'function' ? panOrUpdater(state.pan) : panOrUpdater,
    }));
  },

  // Layout
  layoutStyle: 'vertical',
  groupByFamily: false,
  adjustSpacing: true,
  setLayoutStyle: (layoutStyle) => set({ layoutStyle }),
  toggleLayoutStyle: () => {
    set((state) => ({
      layoutStyle: state.layoutStyle === 'vertical' ? 'horizontal' : 'vertical',
    }));
  },
  toggleGroupByFamily: () => {
    set((state) => ({ groupByFamily: !state.groupByFamily }));
  },
  toggleAdjustSpacing: () => {
    set((state) => ({ adjustSpacing: !state.adjustSpacing }));
  },

  // Selection
  selectedPersonId: null,
  selectedPersonIds: new Set<string>(),
  comparisonPersonId: null,
  selectedUnionId: null,
  focusPersonId: null,
  collapsedPersonIds: new Set(),

  selectPerson: (personId, event) => {
    if (!personId) {
      set({
        selectedPersonId: null,
        selectedPersonIds: new Set(),
        comparisonPersonId: null,
      });
      return;
    }

    // Shift + Click: toggle membership in multi-selection
    if (event && event.shiftKey) {
      set((state) => {
        const next = new Set(state.selectedPersonIds);
        if (next.has(personId)) {
          next.delete(personId);
          const nextSelected =
            state.selectedPersonId === personId
              ? Array.from(next)[0] || null
              : state.selectedPersonId;
          return {
            selectedPersonIds: next,
            selectedPersonId: nextSelected,
            comparisonPersonId: null,
          };
        } else {
          next.add(personId);
          return {
            selectedPersonIds: next,
            selectedPersonId: personId,
            comparisonPersonId: null,
          };
        }
      });
      return;
    }

    // Ctrl/Meta + Click: comparison mode
    if (event && (event.ctrlKey || event.metaKey)) {
      const currentSelected = get().selectedPersonId;
      if (currentSelected && currentSelected !== personId) {
        set({
          comparisonPersonId: personId,
          selectedPersonIds: new Set([currentSelected, personId]),
        });
        return;
      }
    }

    // Normal click: select single person
    set({
      selectedPersonId: personId,
      selectedPersonIds: new Set([personId]),
      comparisonPersonId: null,
    });
  },

  multiSelectPeople: (personIds, append = true) => {
    set((state) => {
      const next = append ? new Set(state.selectedPersonIds) : new Set<string>();
      personIds.forEach((id) => next.add(id));
      const nextSelected =
        next.size > 0 && (!state.selectedPersonId || !next.has(state.selectedPersonId))
          ? personIds[0] || Array.from(next)[0]
          : state.selectedPersonId;
      return {
        selectedPersonIds: next,
        selectedPersonId: nextSelected,
        comparisonPersonId: null,
      };
    });
  },

  setComparisonPersonId: (id) => set({ comparisonPersonId: id }),

  swapComparison: () => {
    const { selectedPersonId, comparisonPersonId } = get();
    if (selectedPersonId && comparisonPersonId) {
      set({
        selectedPersonId: comparisonPersonId,
        comparisonPersonId: selectedPersonId,
      });
    }
  },

  setSelectedUnionId: (id) => set({ selectedUnionId: id }),

  toggleFocus: (personId) => {
    set((state) => ({
      focusPersonId: state.focusPersonId === personId ? null : personId,
    }));
  },

  clearFocus: () => set({ focusPersonId: null }),

  toggleCollapse: (personId) => {
    set((state) => {
      const next = new Set(state.collapsedPersonIds);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return { collapsedPersonIds: next };
    });
  },

  clearSelection: () => {
    set({
      selectedPersonId: null,
      selectedPersonIds: new Set(),
      comparisonPersonId: null,
      selectedUnionId: null,
    });
  },

  // Transient drag
  draggingPersonId: null,
  dragOffset: null,
  setTransientDrag: (draggingPersonId, dragOffset) => {
    set({ draggingPersonId, dragOffset });
  },

  // Presentation layout overrides
  layoutOverrides: {},
  updatePersonPosition: (personId, x, y) => {
    set((state) => ({
      layoutOverrides: {
        ...state.layoutOverrides,
        [personId]: { x, y },
      },
    }));
  },
  setLayoutOverrides: (overridesOrUpdater) => {
    set((state) => ({
      layoutOverrides:
        typeof overridesOrUpdater === 'function'
          ? overridesOrUpdater(state.layoutOverrides)
          : overridesOrUpdater,
    }));
  },
  clearLayoutOverrides: () => {
    set({ layoutOverrides: {} });
  },
}));
