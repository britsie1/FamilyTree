import { useEffect } from 'react';
import { useTreeStore } from '../stores/useTreeStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useTemporalStore } from '../stores/useTemporalStore';
import { useCollabStore } from '../stores/useCollabStore';
import { useModalStore } from '../stores/useModalStore';
import { getTreeYearBounds } from '../services/temporalEngine';

export interface UseTreeKeyboardShortcutsOptions {
  onEscape?: () => boolean | void;
}

export function useTreeKeyboardShortcuts(options?: UseTreeKeyboardShortcutsOptions) {
  const onEscape = options?.onEscape;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const treeState = useTreeStore.getState();
      const canvasState = useCanvasStore.getState();
      const temporalState = useTemporalStore.getState();
      const collabState = useCollabStore.getState();
      const modalState = useModalStore.getState();

      const isReadOnly = collabState.userPermission === 'viewer';

      // 1. Undo / Redo shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (isReadOnly) return;
        e.preventDefault();
        if (e.shiftKey) {
          if (treeState.canRedo) treeState.redo();
        } else {
          if (treeState.canUndo) treeState.undo();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        if (isReadOnly) return;
        e.preventDefault();
        if (treeState.canRedo) treeState.redo();
        return;
      }

      // 2. Zoom shortcuts (Ctrl/Meta + '+', '-', '0')
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          canvasState.setZoom((z) => Math.min(z * 1.15, 2.5));
          return;
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          canvasState.setZoom((z) => Math.max(z * 0.85, 0.2));
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          canvasState.setZoom(1);
          canvasState.setPan({ x: 200, y: 100 });
          return;
        }
      }

      // 3. Escape key handling
      if (e.key === 'Escape') {
        if (onEscape && onEscape()) {
          return;
        }

        if (modalState.activeModal !== null) {
          modalState.closeAllModals();
          return;
        }

        if (temporalState.activeMoment) {
          temporalState.setActiveMoment(null);
          return;
        }

        if (canvasState.focusPersonId) {
          canvasState.clearFocus();
          return;
        }

        if (canvasState.comparisonPersonId) {
          canvasState.setComparisonPersonId(null);
          return;
        }

        canvasState.clearSelection();
        return;
      }

      // 4. Timeline scrub (ArrowLeft / ArrowRight)
      if (temporalState.isTimelineActive) {
        const tree = treeState.tree;
        const bounds = getTreeYearBounds(tree);

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          temporalState.setTemporalYear((y) =>
            Math.max(bounds.minYear, (y ?? bounds.defaultYear) - 1)
          );
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          temporalState.setTemporalYear((y) =>
            Math.min(bounds.maxYear, (y ?? bounds.defaultYear) + 1)
          );
        }
      }

      // 5. Tree Health & Statistics toggle ('h' or 'H')
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        if (modalState.isStatisticsModalOpen) {
          modalState.closeStatisticsModal();
        } else {
          modalState.openStatisticsModal();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEscape]);
}
