import { useState, useEffect, useCallback, useRef } from 'react';
import type { TreeData } from '../types/tree';
import { loadCurrentTree, loadTreeById } from '../services/storage';
import { getCloudTree } from '../services/firestoreService';
import { useTreeStore } from '../stores/useTreeStore';
import { useCollabStore } from '../stores/useCollabStore';

export interface UseTreeRoutingOptions {
  onSwitchTree?: (tree: TreeData, isCloud?: boolean) => void;
}

export function useTreeRouting(options?: UseTreeRoutingOptions) {
  const onSwitchTree = options?.onSwitchTree;
  const onSwitchTreeRef = useRef(onSwitchTree);

  useEffect(() => {
    onSwitchTreeRef.current = onSwitchTree;
  }, [onSwitchTree]);

  const [treeId, setTreeId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('treeId');
  });

  const updateTreeUrl = useCallback((newTreeId: string | null, isCloud?: boolean, replace?: boolean) => {
    if (typeof window === 'undefined') return;

    if (isCloud && newTreeId) {
      const url = `?treeId=${encodeURIComponent(newTreeId)}`;
      if (replace) {
        window.history.replaceState({}, '', url);
      } else {
        window.history.pushState({}, '', url);
      }
      setTreeId(newTreeId);
    } else {
      const url = window.location.pathname;
      if (replace) {
        window.history.replaceState({}, '', url);
      } else {
        window.history.pushState({}, '', url);
      }
      setTreeId(null);
    }
  }, []);

  const clearTreeUrl = useCallback((replace = false) => {
    updateTreeUrl(null, false, replace);
  }, [updateTreeUrl]);

  // Synchronize tree on browser Back/Forward (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlTreeId = params.get('treeId');
      setTreeId(urlTreeId);

      const currentTree = useTreeStore.getState().tree;
      const isCloudTree = useCollabStore.getState().isCloudTree;

      if (urlTreeId) {
        if (urlTreeId === currentTree.id && isCloudTree) return;
        let loaded: TreeData | null = await getCloudTree(urlTreeId).catch(() => null);
        let isCloud = true;
        if (!loaded) {
          loaded = loadTreeById(urlTreeId);
          isCloud = Boolean((loaded as any)?.ownerId);
        }
        if (loaded && onSwitchTreeRef.current) {
          onSwitchTreeRef.current(loaded, isCloud);
        }
      } else {
        if (!isCloudTree) return;
        const local = loadCurrentTree();
        if (onSwitchTreeRef.current) {
          onSwitchTreeRef.current(local, false);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return {
    treeId,
    updateTreeUrl,
    clearTreeUrl,
    setTreeId,
  };
}
