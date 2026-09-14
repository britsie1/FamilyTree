import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { TreeData, Union, Person } from './types/tree';
import {
  loadCurrentTree,
  loadTreeById,
  saveCurrentTree,
  exportTreeToJsonFile,
  importTreeFromJsonString,
  createDoubleInLawPreset,
  createDivorceBlendedPreset,
  createThreeGenSampleTree,
  createBlankTree,
} from './services/storage';
import {
  getPersonDisplayName,
  createTreeFromPeople,
} from './services/treeOperations';
import { getBranchPersonIds } from './services/layoutEngine';
import { useAsyncLayout } from './services/layoutClient';
import { TreeCanvas } from './components/Canvas/TreeCanvas';
import { ContextMenu } from './components/Canvas/ContextMenu';
import { TopNavbar } from './components/Toolbar/TopNavbar';
import { ZoomControls } from './components/Toolbar/ZoomControls';
import { PersonInspector } from './components/Inspector/PersonInspector';
import { EdgeCaseModal } from './components/Modal/EdgeCaseModal';
import { AddRelationshipModal, type RelationType } from './components/Modal/AddRelationshipModal';
import { EditUnionModal } from './components/Modal/EditUnionModal';
import { TreeManagerModal } from './components/Modal/TreeManagerModal';
import { CreateTreeFromSelectionModal } from './components/Modal/CreateTreeFromSelectionModal';
import { ShareTreeModal } from './components/Modal/ShareTreeModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  getCloudTree,
  updateCloudTreeData,
  subscribeToCloudTree,
  resolveUserPermission,
} from './services/firestoreService';
import { toPng } from 'html-to-image';
import confetti from 'canvas-confetti';
import { findRelationship, type RelationshipResult } from './services/relationshipFinder';
import { RelationshipCard } from './components/Canvas/RelationshipCard';
import { parseGedcom, exportGedcomToFile } from './services/gedcomService';
import { Target, X, GitFork, Lock, LogIn, Eye, Copy, Loader2 } from 'lucide-react';
import { TemporalScrubBar } from './components/Toolbar/TemporalScrubBar';
import { getTreeYearBounds } from './services/temporalEngine';

// Centralized Stores
import { useTreeStore } from './stores/useTreeStore';
import { useCanvasStore } from './stores/useCanvasStore';
import { useTemporalStore } from './stores/useTemporalStore';
import { useCollabStore } from './stores/useCollabStore';

export function App() {
  return (
    <AuthProvider>
      <FamilyTreeMain />
    </AuthProvider>
  );
}

/**
 * Produces a stable structural fingerprint of a tree for equality checking,
 * ignoring timestamps and key ordering.
 */
function getTreeContentFingerprint(tree: TreeData): string {
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
    people: sortedP,
    unions: sortedU,
  });
}

function FamilyTreeMain() {
  const { user, signInWithGoogle, signInAnonymouslyUser } = useAuth();

  // Tree Store
  const tree = useTreeStore((s) => s.tree);
  const setTree = useTreeStore((s) => s.setTree);
  const undo = useTreeStore((s) => s.undo);
  const redo = useTreeStore((s) => s.redo);
  const canUndo = useTreeStore((s) => s.canUndo);
  const canRedo = useTreeStore((s) => s.canRedo);
  const resetHistory = useTreeStore((s) => s.resetHistory);
  const updateTreeName = useTreeStore((s) => s.updateTreeName);
  const updatePerson = useTreeStore((s) => s.updatePerson);
  const updatePersonPosition = useTreeStore((s) => s.updatePersonPosition);
  const updateUnion = useTreeStore((s) => s.updateUnion);
  const deleteUnion = useTreeStore((s) => s.deleteUnion);
  const deletePerson = useTreeStore((s) => s.deletePerson);
  const addPerson = useTreeStore((s) => s.addPerson);
  const addChild = useTreeStore((s) => s.addChild);
  const addSibling = useTreeStore((s) => s.addSibling);
  const addPartner = useTreeStore((s) => s.addPartner);
  const addParent = useTreeStore((s) => s.addParent);
  const linkChild = useTreeStore((s) => s.linkChild);
  const linkSibling = useTreeStore((s) => s.linkSibling);
  const linkPartner = useTreeStore((s) => s.linkPartner);
  const linkParent = useTreeStore((s) => s.linkParent);
  const unlinkPartnerAction = useTreeStore((s) => s.unlinkPartnerAction);
  const unlinkChildAction = useTreeStore((s) => s.unlinkChildAction);
  const unlinkParentFromChildAction = useTreeStore((s) => s.unlinkParentFromChildAction);
  const resetLayoutAction = useTreeStore((s) => s.resetLayout);
  const makeCopyAction = useTreeStore((s) => s.makeCopy);

  // Canvas Store
  const zoom = useCanvasStore((s) => s.zoom);
  const pan = useCanvasStore((s) => s.pan);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setPan = useCanvasStore((s) => s.setPan);
  const layoutStyle = useCanvasStore((s) => s.layoutStyle);
  const groupByFamily = useCanvasStore((s) => s.groupByFamily);
  const adjustSpacing = useCanvasStore((s) => s.adjustSpacing);
  const toggleLayoutStyle = useCanvasStore((s) => s.toggleLayoutStyle);
  const toggleGroupByFamily = useCanvasStore((s) => s.toggleGroupByFamily);
  const toggleAdjustSpacing = useCanvasStore((s) => s.toggleAdjustSpacing);
  const selectedPersonId = useCanvasStore((s) => s.selectedPersonId);
  const selectedPersonIds = useCanvasStore((s) => s.selectedPersonIds);
  const comparisonPersonId = useCanvasStore((s) => s.comparisonPersonId);
  const selectedUnionId = useCanvasStore((s) => s.selectedUnionId);
  const focusPersonId = useCanvasStore((s) => s.focusPersonId);
  const collapsedPersonIds = useCanvasStore((s) => s.collapsedPersonIds);
  const selectPerson = useCanvasStore((s) => s.selectPerson);
  const multiSelectPeople = useCanvasStore((s) => s.multiSelectPeople);
  const setComparisonPersonId = useCanvasStore((s) => s.setComparisonPersonId);
  const swapComparison = useCanvasStore((s) => s.swapComparison);
  const setSelectedUnionId = useCanvasStore((s) => s.setSelectedUnionId);
  const toggleFocus = useCanvasStore((s) => s.toggleFocus);
  const clearFocus = useCanvasStore((s) => s.clearFocus);
  const toggleCollapse = useCanvasStore((s) => s.toggleCollapse);
  const clearSelection = useCanvasStore((s) => s.clearSelection);

  // Collab Store
  const isCloudTree = useCollabStore((s) => s.isCloudTree);
  const userPermission = useCollabStore((s) => s.userPermission);
  const isReadOnly = userPermission === 'viewer';
  const cloudSyncStatus = useCollabStore((s) => s.cloudSyncStatus);
  const cloudSyncError = useCollabStore((s) => s.cloudSyncError);
  const cloudLoading = useCollabStore((s) => s.cloudLoading);
  const accessDeniedMessage = useCollabStore((s) => s.accessDeniedMessage);
  const isShareModalOpen = useCollabStore((s) => s.isShareModalOpen);
  const setIsCloudTree = useCollabStore((s) => s.setIsCloudTree);
  const setUserPermission = useCollabStore((s) => s.setUserPermission);
  const setCloudSyncStatus = useCollabStore((s) => s.setCloudSyncStatus);
  const setCloudLoading = useCollabStore((s) => s.setCloudLoading);
  const setAccessDeniedMessage = useCollabStore((s) => s.setAccessDeniedMessage);
  const setIsShareModalOpen = useCollabStore((s) => s.setIsShareModalOpen);

  // Temporal Store
  const isTimelineActive = useTemporalStore((s) => s.isTimelineActive);
  const temporalYear = useTemporalStore((s) => s.temporalYear);
  const activeHistoricalMoment = useTemporalStore((s) => s.activeMoment);
  const toggleTimeline = useTemporalStore((s) => s.toggleTimeline);
  const setTemporalYear = useTemporalStore((s) => s.setTemporalYear);
  const setActiveHistoricalMoment = useTemporalStore((s) => s.setActiveMoment);
  const jumpToYear = useTemporalStore((s) => s.jumpToYear);
  const closeTimeline = useTemporalStore((s) => s.closeTimeline);

  // Modals & Context Menu local state
  const [isEdgeCaseModalOpen, setIsEdgeCaseModalOpen] = useState(false);
  const [isTreeManagerOpen, setIsTreeManagerOpen] = useState(false);
  const [isCreateTreeModalOpen, setIsCreateTreeModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    targetPersonId?: string | null;
  } | null>(null);

  // Relationship modal state
  const [relModal, setRelModal] = useState<{
    isOpen: boolean;
    sourcePersonId: string | null;
    relationType: RelationType;
    preferredUnionId?: string;
  }>({
    isOpen: false,
    sourcePersonId: null,
    relationType: 'child',
  });

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const lastSavedCloudFingerprintRef = useRef<string | null>(null);
  const isRemoteSyncRef = useRef<boolean>(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialFitRef = useRef<boolean>(false);

  // Relationship between selected (A) and comparison (B)
  const currentRelationship = useMemo<RelationshipResult | null>(() => {
    if (!selectedPersonId || !comparisonPersonId) return null;
    return findRelationship(tree, selectedPersonId, comparisonPersonId);
  }, [tree, selectedPersonId, comparisonPersonId]);

  // Cloud Tree Initial URL Load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTreeId = params.get('treeId');

    if (!urlTreeId) {
      setIsCloudTree(false);
      setUserPermission('owner');
      setAccessDeniedMessage(null);
      setCloudSyncStatus('synced');
      return;
    }

    let isMounted = true;
    setCloudLoading(true);
    setAccessDeniedMessage(null);

    getCloudTree(urlTreeId)
      .then((cloudTree) => {
        if (!isMounted) return;
        if (!cloudTree) {
          const local = loadTreeById(urlTreeId);
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
          hasInitialFitRef.current = false;
          lastSavedCloudFingerprintRef.current = getTreeContentFingerprint(cloudTree);
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
        const local = loadTreeById(urlTreeId);
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
  }, [user, resetHistory, selectPerson, clearFocus, setIsCloudTree, setUserPermission, setAccessDeniedMessage, setCloudSyncStatus, setCloudLoading, signInAnonymouslyUser]);

  // Real-time Firestore Listener
  useEffect(() => {
    if (!isCloudTree || !tree.id || userPermission === 'none') return;

    const unsubscribe = subscribeToCloudTree(
      tree.id,
      (remoteTree) => {
        if (!remoteTree) return;
        const remoteFingerprint = getTreeContentFingerprint(remoteTree);
        const currentFingerprint = getTreeContentFingerprint(useTreeStore.getState().tree);

        if (
          remoteFingerprint === currentFingerprint ||
          remoteFingerprint === lastSavedCloudFingerprintRef.current
        ) {
          return;
        }

        isRemoteSyncRef.current = true;
        lastSavedCloudFingerprintRef.current = remoteFingerprint;
        setTree(remoteTree, false);

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

  // Auto-save Debounce
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

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      setCloudSyncStatus('saving');

      autoSaveTimerRef.current = setTimeout(async () => {
        lastSavedCloudFingerprintRef.current = currentFingerprint;
        try {
          await updateCloudTreeData(tree);
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

  // Active tree filtered for focus mode
  const activeTree = useMemo(() => {
    if (!focusPersonId || !tree.people[focusPersonId]) return tree;
    const branchIds = getBranchPersonIds(tree, focusPersonId);
    const filteredPeople: Record<string, Person> = {};
    for (const id of branchIds) {
      if (tree.people[id]) filteredPeople[id] = tree.people[id];
    }
    const filteredUnions: Record<string, Union> = {};
    for (const [uId, u] of Object.entries(tree.unions)) {
      if (
        u.partnerIds.some((pId) => branchIds.has(pId)) ||
        u.childrenIds.some((cId) => branchIds.has(cId))
      ) {
        filteredUnions[uId] = u;
      }
    }
    return {
      ...tree,
      people: filteredPeople,
      unions: filteredUnions,
    };
  }, [tree, focusPersonId]);

  // Asynchronous Layout computation via Web Worker
  const { layout } = useAsyncLayout(
    activeTree,
    layoutStyle,
    groupByFamily,
    collapsedPersonIds,
    adjustSpacing
  );

  // Fit to screen
  const fitToScreen = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const bounds = layout.bounds;

    const padding = 140;
    const availableWidth = rect.width - padding;
    const availableHeight = rect.height - padding;

    const scaleX = availableWidth / bounds.width;
    const scaleY = availableHeight / bounds.height;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.25);

    const centerX = bounds.minX + bounds.width / 2;
    const centerY = bounds.minY + bounds.height / 2;

    const newPanX = rect.width / 2 - centerX * newZoom;
    const newPanY = rect.height / 2 - centerY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [layout.bounds, setZoom, setPan]);

  // Initial centering
  useEffect(() => {
    if (!hasInitialFitRef.current && layout.bounds.width > 0) {
      hasInitialFitRef.current = true;
      const timer = setTimeout(() => {
        fitToScreen();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [fitToScreen, layout.bounds.width]);

  // Handlers
  const handleMakeCopy = useCallback(() => {
    hasInitialFitRef.current = false;
    makeCopyAction();
    setIsCloudTree(false);
    setUserPermission('owner');
    setAccessDeniedMessage(null);
    window.history.replaceState({}, '', window.location.pathname);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  }, [makeCopyAction, setIsCloudTree, setUserPermission, setAccessDeniedMessage]);

  const handleSwitchTree = useCallback(
    (newTree: TreeData, isCloud: boolean = false) => {
      hasInitialFitRef.current = false;
      if (isCloud) {
        lastSavedCloudFingerprintRef.current = getTreeContentFingerprint(newTree);
        isRemoteSyncRef.current = true;
      }
      resetHistory(newTree);
      setIsCloudTree(isCloud);

      if (isCloud) {
        const perm = resolveUserPermission(newTree as any, user);
        setUserPermission(perm);
        window.history.pushState({}, '', `?treeId=${encodeURIComponent(newTree.id)}`);
      } else {
        setUserPermission('owner');
        window.history.pushState({}, '', window.location.pathname);
      }

      const initialPersonId = newTree.rootPersonId || Object.keys(newTree.people)[0] || null;
      selectPerson(initialPersonId);
      setSelectedUnionId(null);
      clearFocus();
      setContextMenu(null);
      setAccessDeniedMessage(null);
      const { defaultYear } = getTreeYearBounds(newTree);
      setTemporalYear(defaultYear);
      setActiveHistoricalMoment(null);
    },
    [
      resetHistory,
      setIsCloudTree,
      setUserPermission,
      user,
      selectPerson,
      setSelectedUnionId,
      clearFocus,
      setAccessDeniedMessage,
      setTemporalYear,
      setActiveHistoricalMoment,
    ]
  );

  const handleSelectPreset = (presetKey: 'double_in_law' | 'divorce' | 'royal' | 'blank') => {
    let nextTree: TreeData;
    if (presetKey === 'double_in_law') {
      nextTree = createDoubleInLawPreset();
    } else if (presetKey === 'divorce') {
      nextTree = createDivorceBlendedPreset();
    } else if (presetKey === 'royal') {
      nextTree = createThreeGenSampleTree();
    } else {
      nextTree = createBlankTree();
    }
    nextTree.id = `tree_${presetKey}_${Date.now().toString(36)}`;
    saveCurrentTree(nextTree);
    handleSwitchTree(nextTree);
  };

  const handleCreateNewRelation = () => {
    const { sourcePersonId, relationType, preferredUnionId } = relModal;
    if (!sourcePersonId) return;

    let newId = '';
    if (relationType === 'child') {
      newId = addChild(sourcePersonId, preferredUnionId);
    } else if (relationType === 'sibling') {
      newId = addSibling(sourcePersonId);
    } else if (relationType === 'partner') {
      newId = addPartner(sourcePersonId);
    } else if (relationType === 'parent') {
      newId = addParent(sourcePersonId);
    }

    if (newId) {
      selectPerson(newId);
    }
  };

  const handleLinkExistingRelation = (targetPersonId: string) => {
    const { sourcePersonId, relationType, preferredUnionId } = relModal;
    if (!sourcePersonId || !targetPersonId) return;

    if (relationType === 'child') {
      linkChild(sourcePersonId, targetPersonId, preferredUnionId);
    } else if (relationType === 'sibling') {
      linkSibling(sourcePersonId, targetPersonId);
    } else if (relationType === 'partner') {
      linkPartner(sourcePersonId, targetPersonId);
    } else if (relationType === 'parent') {
      linkParent(sourcePersonId, targetPersonId);
    }

    selectPerson(targetPersonId);
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
  };

  const handleAddChildToUnion = (unionId: string) => {
    const union = tree.unions[unionId];
    if (!union) return;
    const firstPartner = union.partnerIds[0];
    if (firstPartner) {
      setRelModal({
        isOpen: true,
        sourcePersonId: firstPartner,
        relationType: 'child',
        preferredUnionId: unionId,
      });
    }
  };

  const handlePersonContextMenu = useCallback(
    (e: React.MouseEvent, personId: string) => {
      e.preventDefault();
      selectPerson(personId, e);
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        targetPersonId: personId,
      });
    },
    [selectPerson]
  );

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (selectedPersonIds.size > 0) {
        setContextMenu({
          isOpen: true,
          x: e.clientX,
          y: e.clientY,
        });
      }
    },
    [selectedPersonIds.size]
  );

  const handleCreateTreeFromSelection = useCallback(
    (name: string, switchImmediately: boolean) => {
      const selectedArray = Array.from(selectedPersonIds);
      if (selectedArray.length === 0) return;

      const newTree = createTreeFromPeople(tree, selectedArray, name);
      saveCurrentTree(newTree);

      if (switchImmediately) {
        handleSwitchTree(newTree);
        confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
      } else {
        confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });
      }
    },
    [selectedPersonIds, tree, handleSwitchTree]
  );

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let importedTree: TreeData;

        if (file.name.toLowerCase().endsWith('.ged')) {
          importedTree = parseGedcom(content, file.name.replace(/\.[^/.]+$/, ''));
        } else {
          importedTree = importTreeFromJsonString(content);
        }

        saveCurrentTree(importedTree);
        handleSwitchTree(importedTree);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } catch (err: any) {
        alert(`Error importing tree file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleExportImage = async () => {
    const container = canvasContainerRef.current;
    if (!container) return;

    try {
      const dataUrl = await toPng(container, {
        quality: 0.95,
        backgroundColor: '#f8fafc',
      });

      const a = document.createElement('a');
      a.download = `${(tree.name || 'family_tree').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      a.href = dataUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 } });
    } catch (err) {
      console.error('Failed to export image:', err);
      alert('Could not export tree image. Try zooming out and retrying.');
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
        } else if (isCreateTreeModalOpen) {
          setIsCreateTreeModalOpen(false);
        } else if (activeHistoricalMoment) {
          setActiveHistoricalMoment(null);
        } else if (focusPersonId) {
          clearFocus();
        } else if (comparisonPersonId) {
          setComparisonPersonId(null);
        } else {
          clearSelection();
        }
        setRelModal((prev) => ({ ...prev, isOpen: false }));
      }

      if (isTimelineActive) {
        if (e.key === 'ArrowLeft') {
          const bounds = getTreeYearBounds(tree);
          setTemporalYear((y) => Math.max(bounds.minYear, (y ?? bounds.defaultYear) - 1));
        } else if (e.key === 'ArrowRight') {
          const bounds = getTreeYearBounds(tree);
          setTemporalYear((y) => Math.min(bounds.maxYear, (y ?? bounds.defaultYear) + 1));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    comparisonPersonId,
    focusPersonId,
    isTimelineActive,
    tree,
    activeHistoricalMoment,
    contextMenu,
    isCreateTreeModalOpen,
    clearFocus,
    setComparisonPersonId,
    clearSelection,
    setActiveHistoricalMoment,
    setTemporalYear,
  ]);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-slate-50 relative">
      {/* Top Navbar */}
      <TopNavbar
        tree={tree}
        onUpdateTreeName={updateTreeName}
        onSelectPreset={handleSelectPreset}
        onOpenTreeManager={() => setIsTreeManagerOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        isReadOnly={isReadOnly}
        isCloudTree={isCloudTree}
        userPermission={userPermission}
        cloudSyncStatus={cloudSyncStatus}
        cloudSyncError={cloudSyncError}
        onMakeCopy={handleMakeCopy}
        onAddPerson={() => {
          if (isReadOnly) return;
          const p = addPerson({ firstName: '', lastName: '' });
          selectPerson(p.id);
        }}
        onExportJson={() => exportTreeToJsonFile(tree)}
        onExportGedcom={() => {
          exportGedcomToFile(tree);
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        }}
        onImportFile={handleImportFile}
        onExportImage={handleExportImage}
        onSelectPerson={(id) => selectPerson(id)}
        onOpenEdgeCaseModal={() => setIsEdgeCaseModalOpen(true)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo && !isReadOnly}
        canRedo={canRedo && !isReadOnly}
      />

      {/* Main Canvas Area */}
      <main className="flex-1 relative w-full h-full overflow-hidden touch-none select-none overscroll-none">
        {cloudLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xs z-50 flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span>Loading tree from cloud...</span>
          </div>
        )}

        {/* View-Only Mode Banner */}
        {isReadOnly && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3.5 z-40 text-xs animate-in slide-in-from-top duration-200 border border-amber-400 font-medium">
            <div className="flex items-center gap-1.5 font-bold">
              <Eye className="w-4 h-4 text-slate-950 flex-shrink-0" />
              <span>You have View-Only access to this family tree.</span>
            </div>
            <button
              onClick={handleMakeCopy}
              className="bg-slate-950 hover:bg-slate-900 text-white px-3 py-1 rounded-xl text-[11px] font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer hover:scale-105"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>Make a Copy to Edit</span>
            </button>
          </div>
        )}

        {/* Floating Focus Mode Banner */}
        {focusPersonId && tree.people[focusPersonId] && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-900/90 text-white backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 z-40 text-xs animate-in slide-in-from-top duration-200 border border-indigo-700/50">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-indigo-300 flex-shrink-0" />
              <span>
                Viewing focused branch for{' '}
                <strong>{getPersonDisplayName(tree.people[focusPersonId])}</strong>
              </span>
            </div>
            <button
              onClick={() => {
                clearFocus();
                setTimeout(fitToScreen, 60);
              }}
              className="bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors flex items-center gap-1 text-white shadow-xs"
            >
              <X className="w-3.5 h-3.5" />
              <span>Show Full Tree</span>
            </button>
          </div>
        )}

        <TreeCanvas
          tree={tree}
          layout={layout}
          layoutStyle={layoutStyle}
          selectedPersonId={selectedPersonId}
          selectedPersonIds={selectedPersonIds}
          comparisonPersonId={comparisonPersonId}
          relationshipPathIds={currentRelationship?.path || []}
          temporalYear={isTimelineActive ? temporalYear : null}
          activeMoment={activeHistoricalMoment}
          onSelectPerson={selectPerson}
          onMultiSelectPeople={multiSelectPeople}
          onPersonContextMenu={handlePersonContextMenu}
          onCanvasContextMenu={handleCanvasContextMenu}
          onUpdatePersonPosition={(id, x, y) => updatePersonPosition(id, x, y, layoutStyle)}
          onFinishDragPerson={() => setTree((prev) => ({ ...prev }), true)}
          onToggleCollapse={toggleCollapse}
          onAddChild={(id) => setRelModal({ isOpen: true, sourcePersonId: id, relationType: 'child' })}
          onAddPartner={(id) => setRelModal({ isOpen: true, sourcePersonId: id, relationType: 'partner' })}
          onAddSibling={(id) => setRelModal({ isOpen: true, sourcePersonId: id, relationType: 'sibling' })}
          onAddParent={(id) => setRelModal({ isOpen: true, sourcePersonId: id, relationType: 'parent' })}
          onAddChildToUnion={handleAddChildToUnion}
          onSelectUnion={setSelectedUnionId}
          zoom={zoom}
          setZoom={setZoom}
          pan={pan}
          setPan={setPan}
          canvasContainerRef={canvasContainerRef}
        />

        {/* Multi-Selection HUD */}
        {selectedPersonIds.size > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3.5 z-40 text-xs border border-slate-700/60 animate-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="font-semibold text-slate-100">
                {selectedPersonIds.size} people selected
              </span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <button
              onClick={() => setIsCreateTreeModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer hover:scale-105"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Create new tree</span>
            </button>
            <button
              onClick={clearSelection}
              className="text-slate-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Deselect all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <ContextMenu
            isOpen={contextMenu.isOpen}
            x={contextMenu.x}
            y={contextMenu.y}
            selectedCount={selectedPersonIds.size || 1}
            onCreateNewTree={() => {
              setContextMenu(null);
              setIsCreateTreeModalOpen(true);
            }}
            onDeselectAll={() => {
              setContextMenu(null);
              clearSelection();
            }}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Floating Zoom & View Controls */}
        <ZoomControls
          zoom={zoom}
          onZoomIn={() => setZoom((z) => Math.min(z * 1.15, 2.5))}
          onZoomOut={() => setZoom((z) => Math.max(z * 0.85, 0.2))}
          onResetZoom={() => {
            setZoom(1);
            setPan({ x: 200, y: 100 });
          }}
          onFitToScreen={fitToScreen}
          layoutStyle={layoutStyle}
          onToggleLayoutStyle={() => {
            toggleLayoutStyle();
            setTimeout(fitToScreen, 60);
          }}
          onResetLayout={() => {
            resetLayoutAction();
            setTimeout(fitToScreen, 50);
          }}
          groupByFamily={groupByFamily}
          onToggleGroupByFamily={() => {
            toggleGroupByFamily();
            setTimeout(fitToScreen, 60);
          }}
          adjustSpacing={adjustSpacing}
          onToggleAdjustSpacing={() => {
            toggleAdjustSpacing();
            setTimeout(fitToScreen, 50);
          }}
          isTimelineActive={isTimelineActive}
          onToggleTimeline={() => {
            const { defaultYear } = getTreeYearBounds(tree);
            toggleTimeline(defaultYear);
          }}
          temporalYear={isTimelineActive ? temporalYear : null}
        />

        {/* Floating Relationship Comparison Card */}
        {currentRelationship && (
          <RelationshipCard
            tree={tree}
            relationship={currentRelationship}
            onSwap={swapComparison}
            onClose={() => setComparisonPersonId(null)}
            onSelectPerson={(id) => {
              selectPerson(id);
              setComparisonPersonId(null);
            }}
          />
        )}

        {/* 4D Temporal Scrub Bar ("Who Was in the Room?") */}
        {isTimelineActive && (
          <TemporalScrubBar
            tree={tree}
            temporalYear={temporalYear}
            onYearChange={(y) => setTemporalYear(y)}
            onClose={closeTimeline}
            activeMoment={activeHistoricalMoment}
            onSelectMoment={(m) => {
              setActiveHistoricalMoment(m);
              if (m) {
                confetti({ particleCount: 35, spread: 50, origin: { y: 0.75 } });
              }
            }}
          />
        )}

        {/* Selected Person Inspector Panel */}
        <PersonInspector
          tree={tree}
          selectedPersonId={selectedPersonId}
          comparisonPersonId={comparisonPersonId}
          relationship={currentRelationship}
          isFocused={focusPersonId === selectedPersonId}
          onToggleFocus={(id) => {
            toggleFocus(id);
            setTimeout(fitToScreen, 60);
          }}
          isCollapsed={selectedPersonId ? collapsedPersonIds.has(selectedPersonId) : false}
          onToggleCollapse={toggleCollapse}
          onClearComparison={() => setComparisonPersonId(null)}
          onClose={clearSelection}
          onUpdatePerson={updatePerson}
          onDeletePerson={(id) => {
            deletePerson(id);
            if (selectedPersonId === id) clearSelection();
          }}
          onSelectPerson={(id) => selectPerson(id)}
          onAddChild={(id) => setRelModal({ isOpen: true, sourcePersonId: id, relationType: 'child' })}
          onAddPartner={(id) => setRelModal({ isOpen: true, sourcePersonId: id, relationType: 'partner' })}
          onAddSibling={(id) => setRelModal({ isOpen: true, sourcePersonId: id, relationType: 'sibling' })}
          onAddParent={(id) => setRelModal({ isOpen: true, sourcePersonId: id, relationType: 'parent' })}
          onUnlinkPartner={unlinkPartnerAction}
          onUnlinkChild={unlinkChildAction}
          onUnlinkParentFromChild={unlinkParentFromChildAction}
          onEditUnion={setSelectedUnionId}
          onJumpToYear={jumpToYear}
          isReadOnly={isReadOnly}
        />
      </main>

      {/* Modals */}
      <TreeManagerModal
        isOpen={isTreeManagerOpen}
        onClose={() => setIsTreeManagerOpen(false)}
        currentTreeId={tree.id}
        onSwitchTree={handleSwitchTree}
        onOpenShareModal={() => setIsShareModalOpen(true)}
      />

      <ShareTreeModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        tree={tree}
        isCloudTree={isCloudTree}
        onTreeUpdated={(updatedCloudTree) => {
          lastSavedCloudFingerprintRef.current = getTreeContentFingerprint(updatedCloudTree);
          resetHistory(updatedCloudTree);
          setIsCloudTree(true);
          setUserPermission('owner');
          setCloudSyncStatus('synced');
          window.history.pushState({}, '', `?treeId=${encodeURIComponent(updatedCloudTree.id)}`);
        }}
      />

      {/* Access Denied Overlay */}
      {accessDeniedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-xs">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Access Restricted</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {accessDeniedMessage}
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              {!user ? (
                <button
                  onClick={() => signInWithGoogle()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign in with Google</span>
                </button>
              ) : (
                <p className="text-xs text-slate-400">
                  Signed in as <strong>{user.email}</strong>
                </p>
              )}
              <button
                onClick={() => {
                  setAccessDeniedMessage(null);
                  window.history.replaceState({}, '', window.location.pathname);
                  const local = loadCurrentTree();
                  handleSwitchTree(local, false);
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Return to My Local Trees
              </button>
            </div>
          </div>
        </div>
      )}

      <EdgeCaseModal
        isOpen={isEdgeCaseModalOpen}
        onClose={() => setIsEdgeCaseModalOpen(false)}
        onLoadDemo={() => handleSelectPreset('double_in_law')}
      />

      <AddRelationshipModal
        isOpen={relModal.isOpen}
        onClose={() => setRelModal((prev) => ({ ...prev, isOpen: false }))}
        tree={tree}
        sourcePersonId={relModal.sourcePersonId}
        relationType={relModal.relationType}
        onCreateNew={handleCreateNewRelation}
        onLinkExisting={handleLinkExistingRelation}
      />

      <EditUnionModal
        isOpen={Boolean(selectedUnionId)}
        onClose={() => setSelectedUnionId(null)}
        tree={tree}
        unionId={selectedUnionId}
        onUpdateUnion={updateUnion}
        onDeleteUnion={deleteUnion}
        onAddChildToUnion={handleAddChildToUnion}
        onSelectPerson={(id) => {
          selectPerson(id);
          setSelectedUnionId(null);
        }}
      />

      {isCreateTreeModalOpen && (
        <CreateTreeFromSelectionModal
          isOpen={isCreateTreeModalOpen}
          onClose={() => setIsCreateTreeModalOpen(false)}
          tree={tree}
          selectedPersonIds={Array.from(selectedPersonIds)}
          onCreateTree={handleCreateTreeFromSelection}
        />
      )}
    </div>
  );
}

export default App;
