import { useEffect, useRef } from 'react';
import type { TreeData } from '../types/tree';
import { createSnapshot } from '../services/snapshotService';
import { getTreeContentFingerprint } from './useCloudSync';
import { notifySnapshotTaken } from '../stores/useNotificationStore';
import { useModalStore } from '../stores/useModalStore';

export const DEFAULT_PERIODIC_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function usePeriodicSnapshot(
  tree: TreeData,
  intervalMs: number = DEFAULT_PERIODIC_SNAPSHOT_INTERVAL_MS
) {
  const lastSnapshotTimeRef = useRef<number>(0);
  const lastTreeIdRef = useRef<string>(tree?.id);
  const lastSavedFingerprintRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tree?.id) return;

    if (lastSnapshotTimeRef.current === 0) {
      lastSnapshotTimeRef.current = Date.now();
      lastSavedFingerprintRef.current = getTreeContentFingerprint(tree);
    }

    // Reset when switching to a different tree
    if (tree.id !== lastTreeIdRef.current) {
      lastTreeIdRef.current = tree.id;
      lastSnapshotTimeRef.current = Date.now();
      lastSavedFingerprintRef.current = getTreeContentFingerprint(tree);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const currentFingerprint = getTreeContentFingerprint(tree);
    if (currentFingerprint === lastSavedFingerprintRef.current) {
      return;
    }

    const now = Date.now();
    const elapsed = now - lastSnapshotTimeRef.current;

    const performSnapshot = async () => {
      try {
        lastSnapshotTimeRef.current = Date.now();
        lastSavedFingerprintRef.current = currentFingerprint;
        await createSnapshot(tree, 'periodic', 'Periodic auto-save checkpoint');
        notifySnapshotTaken('Periodic auto-save captured during active editing', () => {
          useModalStore.getState().openVersionHistoryModal();
        });
      } catch (err) {
        console.warn('[usePeriodicSnapshot] Failed to create periodic snapshot:', err);
      }
    };

    if (elapsed >= intervalMs) {
      if (timerRef.current) clearTimeout(timerRef.current);
      performSnapshot();
    } else if (!timerRef.current) {
      // Schedule trigger at remaining time
      const delay = intervalMs - elapsed;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        performSnapshot();
      }, delay);
    }

    return () => {
      // Don't clear on every render to preserve debounce timer across small rapid edits
    };
  }, [tree, intervalMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
