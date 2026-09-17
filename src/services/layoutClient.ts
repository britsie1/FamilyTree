import { useState, useEffect, useRef } from 'react';
import type { TreeData, LayoutStyle, TreeLayout, LayoutOverrides } from '../types/tree';
import { computeLayout } from './layoutEngine';

let workerInstance: Worker | null = null;
let workerAvailable: boolean | null = null;

function getWorker(): Worker | null {
  if (workerAvailable === false) return null;
  if (workerInstance) return workerInstance;

  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    try {
      workerInstance = new Worker(
        new URL('../workers/layoutWorker.ts', import.meta.url),
        { type: 'module' }
      );
      workerAvailable = true;
      return workerInstance;
    } catch (err) {
      console.warn('Web Worker creation failed, falling back to main-thread layout:', err);
      workerAvailable = false;
      return null;
    }
  }

  workerAvailable = false;
  return null;
}

let requestSeq = 0;
const pendingCallbacks = new Map<
  number,
  { resolve: (layout: TreeLayout) => void; reject: (err: any) => void }
>();

function initWorkerListener(worker: Worker) {
  worker.onmessage = (e: MessageEvent<{ id: number; layout?: TreeLayout; error?: string }>) => {
    const { id, layout, error } = e.data;
    const cb = pendingCallbacks.get(id);
    if (cb) {
      pendingCallbacks.delete(id);
      if (error) {
        cb.reject(new Error(error));
      } else if (layout) {
        cb.resolve(layout);
      }
    }
  };

  worker.onerror = (err) => {
    console.error('Layout Worker error:', err);
    // Reject all pending
    for (const [id, cb] of pendingCallbacks.entries()) {
      cb.reject(err);
      pendingCallbacks.delete(id);
    }
  };
}

/**
 * Computes layout asynchronously via Web Worker, or synchronously on main thread
 * if Worker is not supported.
 */
export function computeLayoutAsync(
  tree: TreeData,
  layoutStyle: LayoutStyle,
  groupByFamily: boolean,
  collapsedPersonIds: Set<string> | string[],
  adjustSpacing: boolean,
  layoutOverrides?: LayoutOverrides
): Promise<TreeLayout> {
  const collapsedArray = Array.from(collapsedPersonIds);
  const worker = getWorker();

  if (!worker) {
    try {
      const layout = computeLayout(
        tree,
        layoutStyle,
        groupByFamily,
        collapsedArray,
        adjustSpacing,
        layoutOverrides
      );
      return Promise.resolve(layout);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // Ensure listener is attached
  if (!worker.onmessage) {
    initWorkerListener(worker);
  }

  const id = ++requestSeq;
  return new Promise<TreeLayout>((resolve, reject) => {
    pendingCallbacks.set(id, { resolve, reject });
    worker.postMessage({
      id,
      tree,
      layoutStyle,
      groupByFamily,
      collapsedPersonIds: collapsedArray,
      adjustSpacing,
      layoutOverrides,
    });
  });
}

/**
 * React hook that coordinates off-thread layout computation with sequence tracking
 * and retains the previous layout while computing new layouts to avoid UI flickering.
 */
export function useAsyncLayout(
  tree: TreeData,
  layoutStyle: LayoutStyle,
  groupByFamily: boolean,
  collapsedPersonIds: Set<string>,
  adjustSpacing: boolean,
  layoutOverrides?: LayoutOverrides
): { layout: TreeLayout; isComputing: boolean } {
  // Initialize with synchronous computation so first render has immediate layout
  const [layout, setLayout] = useState<TreeLayout>(() =>
    computeLayout(tree, layoutStyle, groupByFamily, collapsedPersonIds, adjustSpacing, layoutOverrides)
  );
  const [isComputing, setIsComputing] = useState(false);
  const currentSeqRef = useRef(0);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    // Skip on very first render since initial state computed it
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    const seq = ++currentSeqRef.current;
    setIsComputing(true);

    computeLayoutAsync(tree, layoutStyle, groupByFamily, collapsedPersonIds, adjustSpacing, layoutOverrides)
      .then((newLayout) => {
        if (seq === currentSeqRef.current) {
          setLayout(newLayout);
          setIsComputing(false);
        }
      })
      .catch((err) => {
        if (seq === currentSeqRef.current) {
          console.error('Failed to compute layout:', err);
          // Fallback to synchronous calculation if worker fails
          try {
            const fallbackLayout = computeLayout(
              tree,
              layoutStyle,
              groupByFamily,
              collapsedPersonIds,
              adjustSpacing,
              layoutOverrides
            );
            setLayout(fallbackLayout);
          } catch (fallbackErr) {
            console.error('Fallback layout also failed:', fallbackErr);
          }
          setIsComputing(false);
        }
      });
  }, [tree, layoutStyle, groupByFamily, collapsedPersonIds, adjustSpacing, layoutOverrides]);

  return { layout, isComputing };
}
