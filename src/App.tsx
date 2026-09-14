import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { TreeData, Person, UnionType, LayoutStyle, Union } from './types/tree';
import {
  loadCurrentTree,
  saveCurrentTree,
  exportTreeToJsonFile,
  importTreeFromJsonString,
  createDoubleInLawPreset,
  createDivorceBlendedPreset,
  createThreeGenSampleTree,
  createBlankTree,
} from './services/storage';
import {
  addChildToPerson,
  addSiblingToPerson,
  addPartnerToPerson,
  addParentToPerson,
  linkExistingChild,
  linkExistingPartner,
  linkExistingParent,
  linkExistingSibling,
  unlinkPartner,
  unlinkChild,
  unlinkParentFromChild,
  createEmptyPerson,
  deletePersonFromTree,
  updatePersonInTree,
  updateUnionInTree,
  clearManualPositions,
  getPersonDisplayName,
} from './services/treeOperations';
import { computeLayout, getBranchPersonIds } from './services/layoutEngine';
import { TreeCanvas } from './components/Canvas/TreeCanvas';
import { TopNavbar } from './components/Toolbar/TopNavbar';
import { ZoomControls } from './components/Toolbar/ZoomControls';
import { PersonInspector } from './components/Inspector/PersonInspector';
import { EdgeCaseModal } from './components/Modal/EdgeCaseModal';
import { AddRelationshipModal, type RelationType } from './components/Modal/AddRelationshipModal';
import { EditUnionModal } from './components/Modal/EditUnionModal';
import { TreeManagerModal } from './components/Modal/TreeManagerModal';
import { toPng } from 'html-to-image';
import confetti from 'canvas-confetti';
import { findRelationship, type RelationshipResult } from './services/relationshipFinder';
import { RelationshipCard } from './components/Canvas/RelationshipCard';
import { useTreeHistory } from './hooks/useTreeHistory';
import { parseGedcom, exportGedcomToFile } from './services/gedcomService';
import { Target, X } from 'lucide-react';
import { TemporalScrubBar } from './components/Toolbar/TemporalScrubBar';
import { getTreeYearBounds, type HistoricalMoment } from './services/temporalEngine';

export function App() {
  const {
    tree,
    setTree,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
  } = useTreeHistory(loadCurrentTree());

  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>('vertical');
  const [groupByFamily, setGroupByFamily] = useState<boolean>(false);
  const [adjustSpacing, setAdjustSpacing] = useState<boolean>(true);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>('me');
  const [comparisonPersonId, setComparisonPersonId] = useState<string | null>(null);
  const [selectedUnionId, setSelectedUnionId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(0.9);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 400, y: 150 });
  const [isEdgeCaseModalOpen, setIsEdgeCaseModalOpen] = useState(false);
  const [isTreeManagerOpen, setIsTreeManagerOpen] = useState(false);

  // Branch Collapsing & Focus Mode state
  const [collapsedPersonIds, setCollapsedPersonIds] = useState<Set<string>>(new Set());
  const [focusPersonId, setFocusPersonId] = useState<string | null>(null);

  // 4D Temporal Scrub Bar ("Who Was in the Room?") state
  const [isTimelineActive, setIsTimelineActive] = useState<boolean>(false);
  const [temporalYear, setTemporalYear] = useState<number | null>(null);
  const [activeHistoricalMoment, setActiveHistoricalMoment] = useState<HistoricalMoment | null>(null);

  // Compute relationship between selectedPersonId (A) and comparisonPersonId (B)
  const currentRelationship = useMemo<RelationshipResult | null>(() => {
    if (!selectedPersonId || !comparisonPersonId) return null;
    return findRelationship(tree, selectedPersonId, comparisonPersonId);
  }, [tree, selectedPersonId, comparisonPersonId]);

  // Add / Link relationship modal state
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

  // Auto-save whenever tree changes
  useEffect(() => {
    saveCurrentTree(tree);
  }, [tree]);

  // Active tree filtered for focus mode if active
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

  // Compute layout & edges
  const layout = useMemo(() => {
    return computeLayout(activeTree, layoutStyle, groupByFamily, collapsedPersonIds, adjustSpacing);
  }, [activeTree, layoutStyle, groupByFamily, collapsedPersonIds, adjustSpacing]);

  // Fit tree nicely into the current screen viewport
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
  }, [layout.bounds]);

  // Initial centering on first load
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToScreen();
    }, 100);
    return () => clearTimeout(timer);
  }, [fitToScreen]);

  // Tree manipulation handlers
  const handleUpdateTreeName = (name: string) => {
    setTree((prev) => ({ ...prev, name }));
  };

  const handleUpdatePerson = (personId: string, updates: Partial<Person>) => {
    setTree((prev) => updatePersonInTree(prev, personId, updates));
  };

  const handleUpdateUnion = (
    unionId: string,
    updates: Partial<{ type: UnionType; marriageDate?: string; divorceDate?: string }>
  ) => {
    setTree((prev) => updateUnionInTree(prev, unionId, updates));
  };

  const handleDeleteUnion = (unionId: string) => {
    setTree((prev) => {
      const nextTree = { ...prev, unions: { ...prev.unions }, people: { ...prev.people } };
      delete nextTree.unions[unionId];
      // Clean up references in people
      Object.keys(nextTree.people).forEach((pId) => {
        const p = nextTree.people[pId];
        if (p.unionIds.includes(unionId)) {
          nextTree.people[pId] = {
            ...p,
            unionIds: p.unionIds.filter((id) => id !== unionId),
          };
        }
        if (p.parentUnionId === unionId) {
          nextTree.people[pId] = {
            ...p,
            parentUnionId: undefined,
          };
        }
      });
      return nextTree;
    });
    setSelectedUnionId(null);
  };

  const handleToggleLayoutStyle = () => {
    setLayoutStyle((prev) => (prev === 'vertical' ? 'horizontal' : 'vertical'));
    setTimeout(fitToScreen, 60);
  };

  const handleToggleGroupByFamily = () => {
    setGroupByFamily((prev) => !prev);
    setTimeout(fitToScreen, 60);
  };

  // Intermediate node position update during drag (does not flood undo history)
  const handleUpdatePersonPosition = useCallback(
    (personId: string, x: number, y: number) => {
      if (layoutStyle === 'horizontal') {
        setTree(
          (prev) => updatePersonInTree(prev, personId, { horizontalX: x, horizontalY: y }),
          false
        );
      } else {
        setTree((prev) => updatePersonInTree(prev, personId, { x, y }), false);
      }
    },
    [layoutStyle, setTree]
  );

  // Commit single undo snapshot when card drag finishes
  const handleFinishDragPerson = useCallback(() => {
    setTree((prev) => ({ ...prev }), true);
  }, [setTree]);

  const handleToggleCollapse = useCallback((personId: string) => {
    setCollapsedPersonIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }, []);

  const handleToggleFocus = useCallback(
    (personId: string) => {
      setFocusPersonId((prev) => (prev === personId ? null : personId));
      setTimeout(fitToScreen, 60);
    },
    [fitToScreen]
  );

  const handleSelectPerson = useCallback(
    (personId: string | null, event?: React.MouseEvent) => {
      if (!personId) {
        setSelectedPersonId(null);
        setComparisonPersonId(null);
        return;
      }

      if (event && (event.ctrlKey || event.metaKey)) {
        if (selectedPersonId && selectedPersonId !== personId) {
          // Ctrl+Click triggers relationship comparison mode
          setComparisonPersonId(personId);
          return;
        }
      }

      // Normal click: select person and exit comparison
      setSelectedPersonId(personId);
      setComparisonPersonId(null);
    },
    [selectedPersonId]
  );

  const handleSwapComparison = useCallback(() => {
    if (selectedPersonId && comparisonPersonId) {
      const prevA = selectedPersonId;
      const prevB = comparisonPersonId;
      setSelectedPersonId(prevB);
      setComparisonPersonId(prevA);
    }
  }, [selectedPersonId, comparisonPersonId]);

  const handleDeletePerson = (personId: string) => {
    setTree((prev) => deletePersonFromTree(prev, personId));
    if (selectedPersonId === personId) {
      setSelectedPersonId(null);
    }
    if (comparisonPersonId === personId) {
      setComparisonPersonId(null);
    }
  };

  // Open modal to add or link a relation
  const handleOpenAddRelationship = (
    sourcePersonId: string,
    relationType: RelationType,
    preferredUnionId?: string
  ) => {
    setRelModal({
      isOpen: true,
      sourcePersonId,
      relationType,
      preferredUnionId,
    });
  };

  // Action from modal: Create brand new relative
  const handleCreateNewRelation = () => {
    const { sourcePersonId, relationType, preferredUnionId } = relModal;
    if (!sourcePersonId) return;

    setTree((prev) => {
      let nextTree = prev;
      let newId = '';

      if (relationType === 'child') {
        const res = addChildToPerson(prev, sourcePersonId, preferredUnionId);
        nextTree = res.tree;
        newId = res.newChildId;
      } else if (relationType === 'sibling') {
        const res = addSiblingToPerson(prev, sourcePersonId);
        nextTree = res.tree;
        newId = res.newSiblingId;
      } else if (relationType === 'partner') {
        const res = addPartnerToPerson(prev, sourcePersonId);
        nextTree = res.tree;
        newId = res.newPartnerId;
      } else if (relationType === 'parent') {
        const res = addParentToPerson(prev, sourcePersonId);
        nextTree = res.tree;
        newId = res.newParentId;
      }

      if (newId) {
        setSelectedPersonId(newId);
      }
      return nextTree;
    });
  };

  // Action from modal: Link existing relative from tree
  const handleLinkExistingRelation = (targetPersonId: string) => {
    const { sourcePersonId, relationType, preferredUnionId } = relModal;
    if (!sourcePersonId || !targetPersonId) return;

    setTree((prev) => {
      let nextTree = prev;
      if (relationType === 'child') {
        nextTree = linkExistingChild(prev, sourcePersonId, targetPersonId, preferredUnionId);
      } else if (relationType === 'sibling') {
        nextTree = linkExistingSibling(prev, sourcePersonId, targetPersonId);
      } else if (relationType === 'partner') {
        nextTree = linkExistingPartner(prev, sourcePersonId, targetPersonId);
      } else if (relationType === 'parent') {
        nextTree = linkExistingParent(prev, sourcePersonId, targetPersonId);
      }
      return nextTree;
    });

    setSelectedPersonId(targetPersonId);
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
  };

  // Direct addition to specific union anchor
  const handleAddChildToUnion = (unionId: string) => {
    const union = tree.unions[unionId];
    if (!union) return;
    const firstPartner = union.partnerIds[0];
    if (firstPartner) {
      handleOpenAddRelationship(firstPartner, 'child', unionId);
    }
  };

  // Unlink relationships
  const handleUnlinkPartner = (personId: string, unionId: string) => {
    setTree((prev) => unlinkPartner(prev, personId, unionId));
  };

  const handleUnlinkChild = (childPersonId: string) => {
    setTree((prev) => unlinkChild(prev, childPersonId));
  };

  const handleUnlinkParentFromChild = (childPersonId: string, parentPersonId: string) => {
    setTree((prev) => unlinkParentFromChild(prev, childPersonId, parentPersonId));
  };

  const handleAddPerson = () => {
    const newPerson = createEmptyPerson({
      firstName: '',
      lastName: '',
    });
    setTree((prev) => ({
      ...prev,
      people: {
        ...prev.people,
        [newPerson.id]: newPerson,
      },
    }));
    setSelectedPersonId(newPerson.id);
  };

  const handleResetLayout = () => {
    setTree((prev) => clearManualPositions(prev));
    setTimeout(fitToScreen, 50);
  };

  const handleToggleAdjustSpacing = () => {
    setAdjustSpacing((prev) => {
      const next = !prev;
      if (next) {
        setTree((t) => clearManualPositions(t));
      }
      return next;
    });
    setTimeout(fitToScreen, 50);
  };

  // Switching or loading a tree
  const handleSwitchTree = (newTree: TreeData) => {
    setTree(newTree);
    resetHistory(newTree);
    setSelectedPersonId(newTree.rootPersonId || Object.keys(newTree.people)[0] || null);
    setSelectedUnionId(null);
    setComparisonPersonId(null);
    setFocusPersonId(null);
    setCollapsedPersonIds(new Set());
    const { defaultYear } = getTreeYearBounds(newTree);
    setTemporalYear(defaultYear);
    setActiveHistoricalMoment(null);
    setTimeout(fitToScreen, 60);
  };

  const handleToggleTimeline = useCallback(() => {
    setIsTimelineActive((prev) => {
      const next = !prev;
      if (next) {
        if (temporalYear === null) {
          const { defaultYear } = getTreeYearBounds(tree);
          setTemporalYear(defaultYear);
        }
      } else {
        setActiveHistoricalMoment(null);
      }
      return next;
    });
  }, [tree, temporalYear]);

  const handleJumpToYear = useCallback((year: number, moment?: HistoricalMoment | null) => {
    setIsTimelineActive(true);
    setTemporalYear(year);
    if (moment) {
      setActiveHistoricalMoment(moment);
      confetti({ particleCount: 45, spread: 55, origin: { y: 0.7 } });
    } else {
      setActiveHistoricalMoment(null);
    }
  }, []);

  // Loading preset creates a new tree without overwriting active tree
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

  const handleExportJson = () => {
    exportTreeToJsonFile(tree);
  };

  const handleExportGedcom = () => {
    exportGedcomToFile(tree);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  };

  // Unified File Import: Automatically detects GEDCOM or JSON
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
    const plane = document.getElementById('tree-capture-plane');
    const container = canvasContainerRef.current;
    if (!plane || !container) return;

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
        if (activeHistoricalMoment) {
          setActiveHistoricalMoment(null);
        } else if (focusPersonId) {
          setFocusPersonId(null);
        } else if (comparisonPersonId) {
          setComparisonPersonId(null);
        } else {
          setSelectedPersonId(null);
          setSelectedUnionId(null);
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
  }, [comparisonPersonId, focusPersonId, isTimelineActive, tree, activeHistoricalMoment]);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-slate-50 relative">
      {/* Top Navbar */}
      <TopNavbar
        tree={tree}
        layoutStyle={layoutStyle}
        onToggleLayoutStyle={handleToggleLayoutStyle}
        groupByFamily={groupByFamily}
        onToggleGroupByFamily={handleToggleGroupByFamily}
        adjustSpacing={adjustSpacing}
        onToggleAdjustSpacing={handleToggleAdjustSpacing}
        onUpdateTreeName={handleUpdateTreeName}
        onSelectPreset={handleSelectPreset}
        onOpenTreeManager={() => setIsTreeManagerOpen(true)}
        onAddPerson={handleAddPerson}
        onExportJson={handleExportJson}
        onExportGedcom={handleExportGedcom}
        onImportFile={handleImportFile}
        onExportImage={handleExportImage}
        onResetLayout={handleResetLayout}
        onSelectPerson={(id) => handleSelectPerson(id)}
        onOpenEdgeCaseModal={() => setIsEdgeCaseModalOpen(true)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        isTimelineActive={isTimelineActive}
        onToggleTimeline={handleToggleTimeline}
        temporalYear={isTimelineActive ? temporalYear : null}
      />

      {/* Main Canvas Area */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
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
                setFocusPersonId(null);
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
          comparisonPersonId={comparisonPersonId}
          relationshipPathIds={currentRelationship?.path || []}
          temporalYear={isTimelineActive ? temporalYear : null}
          activeMoment={activeHistoricalMoment}
          onSelectPerson={handleSelectPerson}
          onUpdatePersonPosition={handleUpdatePersonPosition}
          onFinishDragPerson={handleFinishDragPerson}
          onToggleCollapse={handleToggleCollapse}
          onAddChild={(id) => handleOpenAddRelationship(id, 'child')}
          onAddPartner={(id) => handleOpenAddRelationship(id, 'partner')}
          onAddSibling={(id) => handleOpenAddRelationship(id, 'sibling')}
          onAddParent={(id) => handleOpenAddRelationship(id, 'parent')}
          onAddChildToUnion={handleAddChildToUnion}
          onSelectUnion={(id) => setSelectedUnionId(id)}
          zoom={zoom}
          setZoom={setZoom}
          pan={pan}
          setPan={setPan}
          canvasContainerRef={canvasContainerRef}
        />

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
        />

        {/* Floating Relationship Comparison Card */}
        {currentRelationship && (
          <RelationshipCard
            tree={tree}
            relationship={currentRelationship}
            onSwap={handleSwapComparison}
            onClose={() => setComparisonPersonId(null)}
            onSelectPerson={(id) => {
              setSelectedPersonId(id);
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
            onClose={() => {
              setIsTimelineActive(false);
              setActiveHistoricalMoment(null);
            }}
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
          onToggleFocus={handleToggleFocus}
          isCollapsed={selectedPersonId ? collapsedPersonIds.has(selectedPersonId) : false}
          onToggleCollapse={handleToggleCollapse}
          onClearComparison={() => setComparisonPersonId(null)}
          onClose={() => {
            setSelectedPersonId(null);
            setComparisonPersonId(null);
          }}
          onUpdatePerson={handleUpdatePerson}
          onDeletePerson={handleDeletePerson}
          onSelectPerson={(id) => handleSelectPerson(id)}
          onAddChild={(id) => handleOpenAddRelationship(id, 'child')}
          onAddPartner={(id) => handleOpenAddRelationship(id, 'partner')}
          onAddSibling={(id) => handleOpenAddRelationship(id, 'sibling')}
          onAddParent={(id) => handleOpenAddRelationship(id, 'parent')}
          onUnlinkPartner={handleUnlinkPartner}
          onUnlinkChild={handleUnlinkChild}
          onUnlinkParentFromChild={handleUnlinkParentFromChild}
          onEditUnion={(id) => setSelectedUnionId(id)}
          onJumpToYear={handleJumpToYear}
        />
      </main>

      {/* Tree Manager Modal */}
      <TreeManagerModal
        isOpen={isTreeManagerOpen}
        onClose={() => setIsTreeManagerOpen(false)}
        currentTreeId={tree.id}
        onSwitchTree={handleSwitchTree}
      />

      {/* Edge Case Solution Modal */}
      <EdgeCaseModal
        isOpen={isEdgeCaseModalOpen}
        onClose={() => setIsEdgeCaseModalOpen(false)}
        onLoadDemo={() => handleSelectPreset('double_in_law')}
      />

      {/* Add or Link Relationship Modal */}
      <AddRelationshipModal
        isOpen={relModal.isOpen}
        onClose={() => setRelModal((prev) => ({ ...prev, isOpen: false }))}
        tree={tree}
        sourcePersonId={relModal.sourcePersonId}
        relationType={relModal.relationType}
        onCreateNew={handleCreateNewRelation}
        onLinkExisting={handleLinkExistingRelation}
      />

      {/* Edit Relationship / Marriage / Divorce Modal */}
      <EditUnionModal
        isOpen={Boolean(selectedUnionId)}
        onClose={() => setSelectedUnionId(null)}
        tree={tree}
        unionId={selectedUnionId}
        onUpdateUnion={handleUpdateUnion}
        onDeleteUnion={handleDeleteUnion}
        onAddChildToUnion={handleAddChildToUnion}
        onSelectPerson={(id) => {
          setSelectedPersonId(id);
          setSelectedUnionId(null);
        }}
      />
    </div>
  );
}

export default App;
