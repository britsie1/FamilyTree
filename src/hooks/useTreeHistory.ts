import { useState, useCallback, useEffect } from 'react';
import type { TreeData } from '../types/tree';

interface UseTreeHistoryReturn {
  tree: TreeData;
  setTree: (
    nextTreeOrUpdater: TreeData | ((prev: TreeData) => TreeData),
    recordHistory?: boolean
  ) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  resetHistory: (newTree: TreeData) => void;
}

const MAX_HISTORY_DEPTH = 50;

export function useTreeHistory(initialTree: TreeData): UseTreeHistoryReturn {
  const [past, setPast] = useState<TreeData[]>([]);
  const [present, setPresent] = useState<TreeData>(initialTree);
  const [future, setFuture] = useState<TreeData[]>([]);

  const setTree = useCallback(
    (
      nextTreeOrUpdater: TreeData | ((prev: TreeData) => TreeData),
      recordHistory: boolean = true
    ) => {
      setPresent((currentPresent) => {
        const nextPresent =
          typeof nextTreeOrUpdater === 'function'
            ? nextTreeOrUpdater(currentPresent)
            : nextTreeOrUpdater;

        if (nextPresent === currentPresent) {
          return currentPresent;
        }

        if (recordHistory) {
          setPast((currentPast) => {
            const updatedPast = [...currentPast, currentPresent];
            if (updatedPast.length > MAX_HISTORY_DEPTH) {
              return updatedPast.slice(updatedPast.length - MAX_HISTORY_DEPTH);
            }
            return updatedPast;
          });
          setFuture([]);
        }

        return nextPresent;
      });
    },
    []
  );

  const undo = useCallback(() => {
    setPast((currentPast) => {
      if (currentPast.length === 0) return currentPast;

      const previous = currentPast[currentPast.length - 1];
      const nextPast = currentPast.slice(0, currentPast.length - 1);

      setPresent((currentPresent) => {
        setFuture((currentFuture) => [currentPresent, ...currentFuture]);
        return previous;
      });

      return nextPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((currentFuture) => {
      if (currentFuture.length === 0) return currentFuture;

      const next = currentFuture[0];
      const nextFuture = currentFuture.slice(1);

      setPresent((currentPresent) => {
        setPast((currentPast) => [...currentPast, currentPresent]);
        return next;
      });

      return nextFuture;
    });
  }, []);

  const resetHistory = useCallback((newTree: TreeData) => {
    setPast([]);
    setPresent(newTree);
    setFuture([]);
  }, []);

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Y / Ctrl+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (!isCtrlOrMeta) return;

      if (e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          // Ctrl+Shift+Z => Redo
          e.preventDefault();
          redo();
        } else {
          // Ctrl+Z => Undo
          e.preventDefault();
          undo();
        }
      } else if (e.key.toLowerCase() === 'y') {
        // Ctrl+Y => Redo
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    tree: present,
    setTree,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    resetHistory,
  };
}
