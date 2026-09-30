import { useEffect, useRef, useCallback } from 'react';
import type { TreeData } from '../types/tree';
import { loadTreeById } from '../services/storage';
import {
  getCloudTree, subscribeToCloudTree, resolveUserPermission, migrateTreeToSubcollections,
} from '../services/firestoreService';
import { useAuth } from './useAuth';
import { useTreeStore } from '../stores/useTreeStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useCollabStore } from '../stores/useCollabStore';
import { cloudSyncBridge } from '../services/cloudSyncBridge';
import { createSnapshot } from '../services/snapshotService';
import { reportLocalSave } from '../services/saveStatus';

export function getTreeContentFingerprint(tree: TreeData): string {
  const sorted = (records: object) => Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify({
    id: tree.id, name: tree.name, description: tree.description,
    rootPersonId: tree.rootPersonId, collapsedPersonIds: tree.collapsedPersonIds,
    googleDriveConfig: tree.googleDriveConfig, layoutOverrides: tree.layoutOverrides,
    horizontalOverrides: tree.horizontalOverrides,
    people: sorted(tree.people), unions: sorted(tree.unions),
  });
}

export function useCloudSync(treeId: string | null | undefined) {
  const { user, signInAnonymouslyUser } = useAuth();
  const tree = useTreeStore((s) => s.tree);
  const isCloudTree = useCollabStore((s) => s.isCloudTree);
  const userPermission = useCollabStore((s) => s.userPermission);
  const lastSnapshotTime = useRef(0);

  const markRemoteSynced = useCallback((remote: TreeData) => {
    cloudSyncBridge.setActiveTree(remote.id);
    const reconciled = cloudSyncBridge.reconcile(remote);
    return reconciled;
  }, []);

  useEffect(() => {
    let mounted = true;
    let loadGeneration = 0;
    const collab = useCollabStore.getState();
    cloudSyncBridge.setActiveTree(treeId || undefined);
    if (!treeId) {
      collab.setIsCloudTree(false);
      collab.setUserPermission('owner');
      collab.setAccessDeniedMessage(null);
      collab.setCloudLoading(false);
      return;
    }
    collab.setCloudLoading(true);
    collab.setAccessDeniedMessage(null);

    const load = async () => {
      const generation = ++loadGeneration;
      try {
        cloudSyncBridge.restore(treeId);
        const remote = await getCloudTree(treeId);
        if (!mounted || generation !== loadGeneration) return;
        if (!remote) throw new Error('The requested cloud tree was not found.');
        const permission = resolveUserPermission(remote, user);
        collab.setUserPermission(permission);
        if (permission === 'none') {
          collab.setIsCloudTree(false);
          collab.setAccessDeniedMessage(user
            ? 'You do not have permission to view this tree. Ask the owner to share it with your email.'
            : 'This tree is private. Sign in with Google to check if you have access.');
          return;
        }
        // Viewer access never uploads recovered edits; keep them durably for export/recovery.
        const recovered = permission === 'viewer' ? remote : cloudSyncBridge.reconcile(remote);
        useTreeStore.getState().resetHistory(recovered);
        collab.setIsCloudTree(true);
        collab.setCloudSyncStatus(cloudSyncBridge.hasPendingPatches(treeId) ? 'saving' : 'synced');
        const canvas = useCanvasStore.getState();
        canvas.selectPerson(recovered.rootPersonId || Object.keys(recovered.people)[0] || null);
        canvas.clearFocus();
        if (!user && permission === 'editor') await signInAnonymouslyUser();
        if (!mounted || generation !== loadGeneration) return;
        if (remote.storageMode !== 'subcollections' && ['owner', 'editor'].includes(permission)) {
          // Do not migrate a tree while outstanding writes still target the old mode.
          if (!cloudSyncBridge.hasPendingPatches(treeId)) {
            void migrateTreeToSubcollections(treeId).catch(console.warn);
          }
        }
      } catch (err) {
        if (!mounted || generation !== loadGeneration) return;
        // Permission failures must not turn a cached viewer into an owner.
        const local = loadTreeById(treeId);
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (local && offline) {
          const cachedPermission = resolveUserPermission(local as Parameters<typeof resolveUserPermission>[0], user);
          useTreeStore.getState().resetHistory(local);
          collab.setIsCloudTree(true);
          collab.setUserPermission(cachedPermission);
          collab.setCloudSyncStatus('offline', 'Saved on this device; waiting for a connection.');
          if (cachedPermission === 'none') collab.setAccessDeniedMessage('Sign in to access this cached private tree.');
        } else {
          collab.setUserPermission('none');
          collab.setCloudSyncStatus('error', err instanceof Error ? err.message : String(err));
          collab.setAccessDeniedMessage('Could not load the cloud tree. Your pending edits remain saved on this device.');
        }
      } finally {
        if (mounted && generation === loadGeneration) {
          collab.setCloudLoading(false);
          const latest = useCollabStore.getState();
          if (latest.isCloudTree && ['owner', 'editor'].includes(latest.userPermission)) {
            void cloudSyncBridge.flushAll(treeId);
          }
        }
      }
    };
    void load();
    const reconnect = () => { collab.setCloudLoading(true); void load(); };
    window.addEventListener('online', reconnect);
    return () => { mounted = false; window.removeEventListener('online', reconnect); };
  }, [treeId, user, signInAnonymouslyUser]);

  useEffect(() => {
    if (!isCloudTree || !treeId || tree.id !== treeId || userPermission === 'none') return;
    const unsubscribe = subscribeToCloudTree(treeId, (remote) => {
      if (!remote || useTreeStore.getState().tree.id !== treeId) return;
      const collab = useCollabStore.getState();
      if (collab.cloudLoading) return;
      const permission = resolveUserPermission(remote, user);
      collab.setUserPermission(permission);
      if (permission === 'none') {
        collab.setAccessDeniedMessage('Your access to this tree has been revoked. Pending edits are retained on this device.');
        return;
      }
      try {
        const current = useTreeStore.getState().tree;
        const recovered = permission === 'viewer' ? remote : cloudSyncBridge.reconcile(remote);
        if (getTreeContentFingerprint(current) !== getTreeContentFingerprint(recovered)) {
          if ((cloudSyncBridge.hasPendingPatches(treeId) ||
              Object.keys(current.people).length - Object.keys(recovered.people).length >= 5) &&
              Date.now() - lastSnapshotTime.current >= 60_000) {
            lastSnapshotTime.current = Date.now();
            void createSnapshot(current, 'pre-cloud-merge', 'Backup before applying cloud changes').catch(console.warn);
          }
          useTreeStore.getState().setTree(recovered, false);
        }
      } catch (err) {
        reportLocalSave(false, err);
      }
    }, (err) => {
      useCollabStore.getState().setCloudSyncStatus('error', err.message || 'Real-time sync error');
    });
    return () => { unsubscribe?.(); };
  }, [isCloudTree, treeId, tree.id, userPermission, user]);

  return { markRemoteSynced };
}