import { useEffect, useRef, useCallback } from 'react';
import type { TreeData } from '../types/tree';
import { loadTreeById, saveCurrentTree } from '../services/storage';
import {
  getCloudTree,
  updateCloudTreeData,
  subscribeToCloudTree,
  resolveUserPermission,
} from '../services/firestoreService';
import { useAuth } from './useAuth';
import { useTreeStore } from '../stores/useTreeStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useCollabStore } from '../stores/useCollabStore';
import { cloudSyncBridge } from '../services/cloudSyncBridge';
import { threeWayMergeTree } from '../services/treeMerge';

/**
 * Produces a stable structural fingerprint of a tree for equality checking,
 * ignoring timestamps and key ordering.
 */
export function getTreeContentFingerprint(tree: TreeData): string {
  const sortedP: Record<string, any> = {};
  for (const k of Object.keys(tree.people || {}).sort()) {
    sortedP[k] = tree.people[k];
  }
  const sortedU: Record<string, any> = {};
  for (const k of Object.keys(tree.unions || {}).sort()) {
    sortedU[k] = tree.unions[k];
  }
  return JSON.stringify({
    id: tree.id,
    name: tree.name,
    description: tree.description,
    rootPersonId: tree.rootPersonId,
    collapsedPersonIds: tree.collapsedPersonIds,
    googleDriveConfig: tree.googleDriveConfig,
    people: sortedP,
    unions: sortedU,
  });
}

export function useCloudSync(treeId: string | null | undefined) {
  const { user, signInAnonymouslyUser } = useAuth();

  const tree = useTreeStore((s) => s.tree);
  const setTree = useTreeStore((s) => s.setTree);
  const resetHistory = useTreeStore((s) => s.resetHistory);

  const selectPerson = useCanvasStore((s) => s.selectPerson);
  const clearFocus = useCanvasStore((s) => s.clearFocus);

  const isCloudTree = useCollabStore((s) => s.isCloudTree);
  const userPermission = useCollabStore((s) => s.userPermission);
  const setIsCloudTree = useCollabStore((s) => s.setIsCloudTree);
  const setUserPermission = useCollabStore((s) => s.setUserPermission);
  const setCloudSyncStatus = useCollabStore((s) => s.setCloudSyncStatus);
  const setCloudLoading = useCollabStore((s) => s.setCloudLoading);
  const setAccessDeniedMessage = useCollabStore((s) => s.setAccessDeniedMessage);

  const lastSavedCloudFingerprintRef = useRef<string | null>(null);
  const lastBaseTreeRef = useRef<TreeData | null>(null);
  const isRemoteSyncRef = useRef<boolean>(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markRemoteSynced = useCallback((treeData: TreeData) => {
    lastSavedCloudFingerprintRef.current = getTreeContentFingerprint(treeData);
    lastBaseTreeRef.current = treeData;
    cloudSyncBridge.setBaseVersion(treeData.version);
    isRemoteSyncRef.current = true;
  }, []);

  // 1. Initial Cloud Tree Load from treeId
  useEffect(() => {
    if (!treeId) {
      setIsCloudTree(false);
      setUserPermission('owner');
      setAccessDeniedMessage(null);
      setCloudSyncStatus('synced');
      return;
    }

    let isMounted = true;
    setCloudLoading(true);
    setAccessDeniedMessage(null);

    getCloudTree(treeId)
      .then((cloudTree) => {
        if (!isMounted) return;
        if (!cloudTree) {
          const local = loadTreeById(treeId);
          if (local) {
            resetHistory(local);
            setIsCloudTree(false);
            setUserPermission('owner');
            setAccessDeniedMessage(null);
            setCloudSyncStatus('synced');
            return;
          }
          setAccessDeniedMessage('The requested family tree could not be found or does not exist.');
          return;
        }

        const perm = resolveUserPermission(cloudTree, user);
        if (perm === 'none') {
          if (!user) {
            setAccessDeniedMessage('This tree is private. Sign in with Google to check if you have access.');
          } else {
            setAccessDeniedMessage('You do not have permission to view this tree. Ask the owner to share it with your email.');
          }
        } else {
          lastSavedCloudFingerprintRef.current = getTreeContentFingerprint(cloudTree);
          lastBaseTreeRef.current = cloudTree;
          cloudSyncBridge.setBaseVersion(cloudTree.version);
          isRemoteSyncRef.current = true;
          resetHistory(cloudTree);
          setIsCloudTree(true);
          setUserPermission(perm);
          setCloudSyncStatus('synced');
          setAccessDeniedMessage(null);
          const initialId = cloudTree.rootPersonId || Object.keys(cloudTree.people)[0] || null;
          selectPerson(initialId);
          clearFocus();

          if (!user && perm === 'editor') {
            signInAnonymouslyUser().catch((anonErr) => {
              console.warn('Background anonymous auth skipped:', anonErr);
            });
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to fetch cloud tree:', err);
        const local = loadTreeById(treeId);
        if (local) {
          resetHistory(local);
          setIsCloudTree(false);
          setUserPermission('owner');
          setAccessDeniedMessage(null);
          return;
        }
        setAccessDeniedMessage('Could not load tree from cloud: ' + (err.message || 'Unknown error'));
      })
      .finally(() => {
        if (isMounted) setCloudLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    treeId,
    user,
    resetHistory,
    selectPerson,
    clearFocus,
    setIsCloudTree,
    setUserPermission,
    setAccessDeniedMessage,
    setCloudSyncStatus,
    setCloudLoading,
    signInAnonymouslyUser,
  ]);

  // 2. Real-time Firestore Listener
  useEffect(() => {
    if (!isCloudTree || !tree.id || userPermission === 'none') return;

    const unsubscribe = subscribeToCloudTree(
      tree.id,
      (remoteTree) => {
        if (!remoteTree) return;
        const currentLocalTree = useTreeStore.getState().tree;
        const remoteFingerprint = getTreeContentFingerprint(remoteTree);
        const currentFingerprint = getTreeContentFingerprint(currentLocalTree);

        if (
          remoteFingerprint === currentFingerprint ||
          remoteFingerprint === lastSavedCloudFingerprintRef.current
        ) {
          return;
        }

        const hasPendingLocal = currentFingerprint !== lastSavedCloudFingerprintRef.current;
        if (hasPendingLocal && lastBaseTreeRef.current) {
          // Perform 3-way merge to integrate remote changes without clobbering local edits
          const mergeResult = threeWayMergeTree(
            lastBaseTreeRef.current,
            currentLocalTree,
            remoteTree
          );
          lastSavedCloudFingerprintRef.current = getTreeContentFingerprint(mergeResult.merged);
          lastBaseTreeRef.current = remoteTree;
          cloudSyncBridge.setBaseVersion(remoteTree.version);
          isRemoteSyncRef.current = true;
          setTree(mergeResult.merged, false);

          if (mergeResult.hasConflict) {
            setCloudSyncStatus(
              'error',
              `Sync conflict: remote changes collided on ${mergeResult.conflicts.length} fields.`
            );
          }
        } else {
          isRemoteSyncRef.current = true;
          lastSavedCloudFingerprintRef.current = remoteFingerprint;
          lastBaseTreeRef.current = remoteTree;
          cloudSyncBridge.setBaseVersion(remoteTree.version);
          setTree(remoteTree, false);
        }

        const newPerm = resolveUserPermission(remoteTree, user);
        if (newPerm !== userPermission) {
          setUserPermission(newPerm);
        }
      },
      (err) => {
        console.error('Real-time sync error:', err);
        setCloudSyncStatus('error', err.message || 'Real-time sync error');
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isCloudTree, tree.id, userPermission, user, setTree, setUserPermission, setCloudSyncStatus]);

  // 3. Debounced Auto-save to Local Storage and Cloud
  useEffect(() => {
    if (userPermission === 'viewer') return;

    saveCurrentTree(tree);

    if (isCloudTree && (userPermission === 'owner' || userPermission === 'editor')) {
      if (isRemoteSyncRef.current) {
        isRemoteSyncRef.current = false;
        return;
      }

      const currentFingerprint = getTreeContentFingerprint(tree);
      if (currentFingerprint === lastSavedCloudFingerprintRef.current) {
        return;
      }

      // Check if there are ONLY granular patches being handled by cloudSyncBridge
      const base = lastBaseTreeRef.current;
      const isStructural =
        !base ||
        base.name !== tree.name ||
        (base.description || '') !== (tree.description || '') ||
        base.rootPersonId !== tree.rootPersonId ||
        Object.keys(base.people || {}).length !== Object.keys(tree.people || {}).length ||
        Object.keys(base.unions || {}).length !== Object.keys(tree.unions || {}).length ||
        JSON.stringify(base.collapsedPersonIds || []) !== JSON.stringify(tree.collapsedPersonIds || []) ||
        JSON.stringify(base.googleDriveConfig || null) !== JSON.stringify(tree.googleDriveConfig || null);

      if (!isStructural && cloudSyncBridge.hasPendingPatches()) {
        // Granular updates are active and debouncing targeted field writes.
        // Do not trigger whole-tree document rewrite!
        return;
      }

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      setCloudSyncStatus('saving');

      autoSaveTimerRef.current = setTimeout(async () => {
        lastSavedCloudFingerprintRef.current = currentFingerprint;
        try {
          const res = await updateCloudTreeData(tree, {
            baseVersion: cloudSyncBridge.getBaseVersion(),
          });
          if (res?.version) {
            cloudSyncBridge.setBaseVersion(res.version);
          }
          lastBaseTreeRef.current = tree;
          setCloudSyncStatus('synced');
        } catch (err: any) {
          console.error('Failed to auto-save to cloud:', err);
          setCloudSyncStatus('error', err.message || 'Failed to auto-save to cloud');
        }
      }, 1000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [tree, isCloudTree, userPermission, setCloudSyncStatus]);

  return {
    markRemoteSynced,
  };
}
