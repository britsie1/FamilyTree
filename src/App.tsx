import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { TreeData, Union, Person } from './types/tree';
import { getBranchPersonIds } from './services/layoutEngine';
import { useAsyncLayout } from './services/layoutClient';
import { TreeCanvas } from './components/Canvas/TreeCanvas';
import { ContextMenu } from './components/Canvas/ContextMenu';
import { TopNavbar } from './components/Toolbar/TopNavbar';
import { ZoomControls } from './components/Toolbar/ZoomControls';
import { TreeOverlays } from './components/Toolbar/TreeOverlays';
import { PersonInspector } from './components/Inspector/PersonInspector';
import { TreeModals } from './components/Modal/TreeModals';
import { AccessDeniedOverlay } from './components/Modal/AccessDeniedOverlay';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { resolveUserPermission } from './services/firestoreService';
import { findRelationship } from './services/relationshipFinder';
import { RelationshipCard } from './components/Canvas/RelationshipCard';
import { Loader2 } from 'lucide-react';
import { TemporalScrubBar } from './components/Toolbar/TemporalScrubBar';
import { getTreeYearBounds } from './services/temporalEngine';
import confetti from 'canvas-confetti';

import { useTreeStore } from './stores/useTreeStore';
import { useCanvasStore } from './stores/useCanvasStore';
import { useTemporalStore } from './stores/useTemporalStore';
import { useCollabStore } from './stores/useCollabStore';
import { useModalStore } from './stores/useModalStore';
import { useCloudSync } from './hooks/useCloudSync';
import { useTreeRouting } from './hooks/useTreeRouting';
import { useTreeKeyboardShortcuts } from './hooks/useTreeKeyboardShortcuts';
import { useTreeLinking } from './hooks/useTreeLinking';
import { useQuickConnect } from './hooks/useQuickConnect';
import { useTreeIO } from './hooks/useTreeIO';

export function App() {
  return (
    <AuthProvider>
      <FamilyTreeMain />
    </AuthProvider>
  );
}

function FamilyTreeMain() {
  const { user } = useAuth();
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const hasInitialFitRef = useRef<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number; targetPersonId?: string | null } | null>(null);

  const tree = useTreeStore((s) => s.tree);
  const focusPersonId = useCanvasStore((s) => s.focusPersonId);
  const selectedPersonId = useCanvasStore((s) => s.selectedPersonId);
  const comparisonPersonId = useCanvasStore((s) => s.comparisonPersonId);
  const collapsedPersonIds = useCanvasStore((s) => s.collapsedPersonIds);
  const layoutStyle = useCanvasStore((s) => s.layoutStyle);
  const groupByFamily = useCanvasStore((s) => s.groupByFamily);
  const adjustSpacing = useCanvasStore((s) => s.adjustSpacing);
  const selectPerson = useCanvasStore((s) => s.selectPerson);
  const canvasOverrides = useCanvasStore((s) => s.layoutOverrides);

  const isCloudTree = useCollabStore((s) => s.isCloudTree);
  const userPermission = useCollabStore((s) => s.userPermission);
  const isReadOnly = userPermission === 'viewer';
  const cloudLoading = useCollabStore((s) => s.cloudLoading);
  const cloudSyncStatus = useCollabStore((s) => s.cloudSyncStatus);
  const cloudSyncError = useCollabStore((s) => s.cloudSyncError);
  const isTimelineActive = useTemporalStore((s) => s.isTimelineActive);
  const temporalYear = useTemporalStore((s) => s.temporalYear);
  const activeMoment = useTemporalStore((s) => s.activeMoment);

  const activeTree = useMemo(() => {
    if (!focusPersonId || !tree.people[focusPersonId]) return tree;
    const branchIds = getBranchPersonIds(tree, focusPersonId);
    const people: Record<string, Person> = {};
    for (const id of branchIds) if (tree.people[id]) people[id] = tree.people[id];
    const unions: Record<string, Union> = {};
    for (const [uId, u] of Object.entries(tree.unions)) {
      if (u.partnerIds.some((p) => branchIds.has(p)) || u.childrenIds.some((c) => branchIds.has(c))) unions[uId] = u;
    }
    return { ...tree, people, unions };
  }, [tree, focusPersonId]);

  const effectiveOverrides = useMemo(() => ({
    ...(layoutStyle === 'horizontal' ? activeTree.horizontalOverrides : activeTree.layoutOverrides),
    ...canvasOverrides,
  }), [layoutStyle, activeTree.horizontalOverrides, activeTree.layoutOverrides, canvasOverrides]);

  const { layout } = useAsyncLayout(activeTree, layoutStyle, groupByFamily, collapsedPersonIds, adjustSpacing, effectiveOverrides);

  const fitToScreen = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const bounds = layout.bounds;
    const padding = 140;
    const newZoom = Math.min(Math.max(Math.min((rect.width - padding) / bounds.width, (rect.height - padding) / bounds.height), 0.35), 1.25);
    useCanvasStore.getState().setZoom(newZoom);
    useCanvasStore.getState().setPan({ x: rect.width / 2 - (bounds.minX + bounds.width / 2) * newZoom, y: rect.height / 2 - (bounds.minY + bounds.height / 2) * newZoom });
  }, [layout.bounds]);

  useEffect(() => {
    if (!hasInitialFitRef.current && layout.bounds.width > 0) {
      hasInitialFitRef.current = true;
      const timer = setTimeout(fitToScreen, 100);
      return () => clearTimeout(timer);
    }
  }, [fitToScreen, layout.bounds.width]);

  const switchTreeRef = useRef<(tree: TreeData, isCloud?: boolean, focusPerson?: string | null) => void>(() => {});
  const { treeId, updateTreeUrl, clearTreeUrl } = useTreeRouting({
    onSwitchTree: (t, c) => switchTreeRef.current(t, c),
  });
  const { markRemoteSynced } = useCloudSync(treeId);

  const handleSwitchTree = useCallback((newTree: TreeData, isCloud?: boolean, focusPerson?: string | null) => {
    const resolvedIsCloud = isCloud !== undefined ? isCloud : Boolean((newTree as any)?.ownerId);
    hasInitialFitRef.current = false;
    if (resolvedIsCloud) markRemoteSynced(newTree);
    useTreeStore.getState().resetHistory(newTree);
    useCollabStore.getState().setIsCloudTree(resolvedIsCloud);
    useCollabStore.getState().setUserPermission(resolvedIsCloud ? resolveUserPermission(newTree as any, user) : 'owner');
    updateTreeUrl(newTree.id, resolvedIsCloud);
    const targetPerson = (focusPerson && newTree.people[focusPerson]) ? focusPerson : (newTree.rootPersonId || Object.keys(newTree.people)[0] || null);
    useCanvasStore.getState().selectPerson((typeof window !== 'undefined' && window.innerWidth >= 768) ? targetPerson : null);
    useCanvasStore.getState().setSelectedUnionId(null);
    useCanvasStore.getState().clearFocus();
    setContextMenu(null);
    useCollabStore.getState().setAccessDeniedMessage(null);
    useTemporalStore.getState().setTemporalYear(getTreeYearBounds(newTree).defaultYear);
    useTemporalStore.getState().setActiveMoment(null);
  }, [user, markRemoteSynced, updateTreeUrl]);

  useEffect(() => {
    switchTreeRef.current = handleSwitchTree;
  }, [handleSwitchTree]);

  useTreeKeyboardShortcuts({ onEscape: () => { if (contextMenu) { setContextMenu(null); return true; } } });
  const { handleOpenTreeLink, handleOpenLinkModal, handleLinkTrees, handleRemoveTreeLink, handleCreateTreeFromSelection } = useTreeLinking({ onSwitchTree: handleSwitchTree });
  const { handleQuickLink, handleQuickSpawnRelative } = useQuickConnect();
  const { handleMakeCopy, handleSelectPreset, handleImportFile, handleExportImage, handleExportJson, handleExportGedcom, handleAddPerson } = useTreeIO({
    containerRef: canvasContainerRef,
    onSwitchTree: handleSwitchTree,
    onClearUrl: () => clearTreeUrl(true),
  });

  const currentRelationship = useMemo(() => (!selectedPersonId || !comparisonPersonId ? null : findRelationship(tree, selectedPersonId, comparisonPersonId)), [tree, selectedPersonId, comparisonPersonId]);

  return (
    <div className="w-full h-full max-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
      <TopNavbar
        tree={tree}
        onUpdateTreeName={useTreeStore.getState().updateTreeName}
        onSelectPreset={handleSelectPreset}
        onOpenTreeManager={useModalStore.getState().openTreeManager}
        onOpenShareModal={useModalStore.getState().openShareModal}
        isReadOnly={isReadOnly}
        isCloudTree={isCloudTree}
        userPermission={userPermission}
        cloudSyncStatus={cloudSyncStatus}
        cloudSyncError={cloudSyncError}
        onMakeCopy={handleMakeCopy}
        onAddPerson={handleAddPerson}
        onExportJson={handleExportJson}
        onExportGedcom={handleExportGedcom}
        onImportFile={handleImportFile}
        onExportImage={handleExportImage}
        onSelectPerson={selectPerson}
        onOpenEdgeCaseModal={useModalStore.getState().openEdgeCaseModal}
        onUndo={useTreeStore.getState().undo} onRedo={useTreeStore.getState().redo}
        canUndo={useTreeStore((s) => s.canUndo) && !isReadOnly} canRedo={useTreeStore((s) => s.canRedo) && !isReadOnly}
      />

      <main className="flex-1 relative w-full h-full overflow-hidden touch-none select-none overscroll-none">
        {cloudLoading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
            <span>Loading tree from cloud...</span>
          </div>
        )}

        <TreeOverlays tree={tree} onMakeCopy={handleMakeCopy} onFitToScreen={fitToScreen} />

        <TreeCanvas
          tree={tree}
          layout={layout}
          canvasContainerRef={canvasContainerRef}
          relationshipPathIds={currentRelationship?.path || []}
          temporalYear={isTimelineActive ? temporalYear : null}
          activeMoment={activeMoment}
          onPersonContextMenu={(e, personId) => { e.preventDefault(); selectPerson(personId, e); setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, targetPersonId: personId }); }}
          onCanvasContextMenu={(e) => { e.preventDefault(); if (useCanvasStore.getState().selectedPersonIds.size > 0) setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY }); }}
          onQuickLink={handleQuickLink}
          onQuickSpawnRelative={handleQuickSpawnRelative}
          onOpenTreeLink={handleOpenTreeLink}
        />

        {contextMenu && (
          <ContextMenu
            isOpen={contextMenu.isOpen}
            x={contextMenu.x}
            y={contextMenu.y}
            selectedCount={useCanvasStore.getState().selectedPersonIds.size || 1}
            onCreateNewTree={() => { setContextMenu(null); useModalStore.getState().openCreateTreeModal(); }}
            onLinkExistingTree={() => {
              const target = contextMenu.targetPersonId ? tree.people[contextMenu.targetPersonId] : (selectedPersonId ? tree.people[selectedPersonId] : null);
              setContextMenu(null);
              handleOpenLinkModal(target);
            }}
            onOpenSunburst={() => {
              const targetId = contextMenu.targetPersonId || selectedPersonId;
              setContextMenu(null);
              if (targetId) {
                useModalStore.getState().openSunburstModal(targetId);
              }
            }}
            onDeselectAll={() => { setContextMenu(null); useCanvasStore.getState().clearSelection(); }}
            onClose={() => setContextMenu(null)}
          />
        )}

        <ZoomControls onFitToScreen={fitToScreen} />

        {currentRelationship && (
          <RelationshipCard
            tree={tree}
            relationship={currentRelationship}
            onSwap={useCanvasStore.getState().swapComparison}
            onClose={() => useCanvasStore.getState().setComparisonPersonId(null)}
            onSelectPerson={(id) => { selectPerson(id); useCanvasStore.getState().setComparisonPersonId(null); }}
          />
        )}

        {isTimelineActive && (
          <TemporalScrubBar
            tree={tree}
            temporalYear={temporalYear}
            onYearChange={useTemporalStore.getState().setTemporalYear}
            onClose={useTemporalStore.getState().closeTimeline}
            activeMoment={activeMoment}
            onSelectMoment={(m) => { useTemporalStore.getState().setActiveMoment(m); if (m) confetti({ particleCount: 35, spread: 50, origin: { y: 0.75 } }); }}
          />
        )}

        <PersonInspector
          onToggleFocus={(id) => { useCanvasStore.getState().toggleFocus(id); setTimeout(fitToScreen, 60); }}
          onOpenTreeLink={handleOpenTreeLink}
          onRemoveTreeLink={handleRemoveTreeLink}
        />
      </main>

      <TreeModals
        onSwitchTree={handleSwitchTree} onSelectPreset={handleSelectPreset}
        onCreateTreeFromSelection={handleCreateTreeFromSelection} onLinkTrees={handleLinkTrees}
      />

      <AccessDeniedOverlay onSwitchTree={handleSwitchTree} onClearUrl={() => clearTreeUrl(true)} />
    </div>
  );
}

export default App;
