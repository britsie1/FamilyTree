import React, { useState, useMemo, useRef, useCallback } from 'react';
import type { TreeData } from '../../types/tree';
import {
  buildSunburstLayout,
  getLevelDescription,
  type ChartAngleMode,
  type ColorThemeMode,
  type SunburstArcNode,
} from '../../services/sunburstService';
import { getPersonDisplayName, getPersonFullName } from '../../services/treeOperations';
import { useThemeStore } from '../../stores/useThemeStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { toPng } from 'html-to-image';
import confetti from 'canvas-confetti';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Palette,
  Compass,
  Layers,
  ChevronRight,
  ExternalLink,
  ChevronLeft,
  Sparkles,
  Info,
  Calendar,
  MapPin,
  HelpCircle,
  SlidersHorizontal,
} from 'lucide-react';

export interface SunburstModalProps {
  isOpen: boolean;
  onClose: () => void;
  tree: TreeData;
  initialPersonId: string | null;
  onSelectPersonInTree?: (personId: string) => void;
}

export const SunburstModal: React.FC<SunburstModalProps> = ({
  isOpen,
  onClose,
  tree,
  initialPersonId,
  onSelectPersonInTree,
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  const selectPerson = useCanvasStore((s) => s.selectPerson);

  // Current root person for the sunburst (supports drill down)
  const [overrideRootId, setOverrideRootId] = useState<string | null>(null);
  const [prevInitialId, setPrevInitialId] = useState<string | null>(initialPersonId);
  const [drillStack, setDrillStack] = useState<string[]>([]);

  // Chart configurations
  const [level, setLevel] = useState<number>(4); // Default: 4 = great-great-grandparents
  const [angleMode, setAngleMode] = useState<ChartAngleMode>('360');
  const [colorTheme, setColorTheme] = useState<ColorThemeMode>('lineage');
  const [fitNames, setFitNames] = useState<boolean>(true); // Adjust each ring to longest name

  // Interactive inspection
  const [hoveredNode, setHoveredNode] = useState<SunburstArcNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<SunburstArcNode | null>(null);

  // If initialPersonId prop changed from parent, reset override and drill stack
  if (initialPersonId !== prevInitialId) {
    setPrevInitialId(initialPersonId);
    setOverrideRootId(null);
    setDrillStack([]);
    setSelectedNode(null);
    setHoveredNode(null);
  }

  // SVG Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  const effectiveRootId = overrideRootId || initialPersonId || tree.rootPersonId || Object.keys(tree.people)[0] || null;

  // Build the layout
  const layout = useMemo(() => {
    if (!effectiveRootId || !tree.people[effectiveRootId]) return null;
    return buildSunburstLayout(tree, effectiveRootId, {
      maxLevel: level,
      angleMode,
      colorTheme,
      isDark,
      baseRadius: 360,
      rootRadius: 74,
      dynamicRingSizes: fitNames,
    });
  }, [tree, effectiveRootId, level, angleMode, colorTheme, isDark, fitNames]);

  const levelInfo = useMemo(() => getLevelDescription(level), [level]);

  // Handle drill-down into an ancestor
  const handleDrillDown = useCallback((targetPersonId: string) => {
    if (!tree.people[targetPersonId]) return;
    if (effectiveRootId) {
      setDrillStack((prev) => [...prev, effectiveRootId]);
    }
    setOverrideRootId(targetPersonId);
    setSelectedNode(null);
    setHoveredNode(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [tree, effectiveRootId]);

  // Handle drill back up via stack
  const handleDrillUp = useCallback((targetIndex?: number) => {
    if (drillStack.length === 0) return;
    if (targetIndex !== undefined) {
      const targetId = drillStack[targetIndex];
      setDrillStack((prev) => prev.slice(0, targetIndex));
      setOverrideRootId(targetId);
    } else {
      const newStack = [...drillStack];
      const prevId = newStack.pop()!;
      setDrillStack(newStack);
      setOverrideRootId(prevId);
    }
    setSelectedNode(null);
    setHoveredNode(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [drillStack]);

  // Jump to person in main tree canvas
  const handleJumpToPerson = useCallback((personId: string) => {
    if (onSelectPersonInTree) {
      onSelectPersonInTree(personId);
    } else {
      selectPerson(personId);
    }
    onClose();
  }, [onSelectPersonInTree, selectPerson, onClose]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only left click drags
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((prev) => Math.min(Math.max(0.4, prev * zoomFactor), 4.0));
  };

  const resetViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Export as PNG
  const handleExportPng = async () => {
    if (!svgRef.current) return;
    try {
      const dataUrl = await toPng(svgRef.current as unknown as HTMLElement, {
        backgroundColor: isDark
          ? (colorTheme === 'parchment' ? '#1c1815' : '#020617')
          : (colorTheme === 'parchment' ? '#faf6ee' : '#ffffff'),
        pixelRatio: 2.5,
      });
      const rootPerson = tree.people[effectiveRootId || ''];
      const rootName = rootPerson ? getPersonDisplayName(rootPerson).replace(/\s+/g, '_') : 'tree';
      const a = document.createElement('a');
      a.download = `ancestor_sunburst_${rootName}_gen${level}.png`;
      a.href = dataUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch {
      alert('Could not export PNG image. Please try again.');
    }
  };

  // Export as SVG
  const handleExportSvg = () => {
    if (!svgRef.current) return;
    try {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgRef.current);
      if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const rootPerson = tree.people[effectiveRootId || ''];
      const rootName = rootPerson ? getPersonDisplayName(rootPerson).replace(/\s+/g, '_') : 'tree';
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `ancestor_sunburst_${rootName}_gen${level}.svg`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch {
      alert('Could not export SVG file. Please try again.');
    }
  };

  if (!isOpen) return null;

  const rootPerson = effectiveRootId ? tree.people[effectiveRootId] : null;
  const activeDetailNode = selectedNode || hoveredNode;
  const inspectedPerson = activeDetailNode?.person;

  // Highlight lineage path from root to hovered/selected node
  const activeAhnentafel = activeDetailNode?.slotIndex ?? null;
  const highlightedSlots = new Set<number>();
  if (activeAhnentafel) {
    let curr = activeAhnentafel;
    while (curr >= 1) {
      highlightedSlots.add(curr);
      curr = Math.floor(curr / 2);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ancestor Sunburst Chart"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full h-full max-w-7xl max-h-[96dvh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  Ancestor Sunburst Chart
                </h2>
                {layout && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    <span>
                      {layout.filledSlots} of {layout.totalSlots} ancestors ({layout.completionPercentage}%)
                    </span>
                  </span>
                )}
              </div>

              {/* Breadcrumb line for drill-down navigation */}
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {drillStack.length > 0 && (
                  <button
                    onClick={() => handleDrillUp()}
                    className="flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                    title="Go back one level"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <span>Back</span>
                  </button>
                )}
                {drillStack.map((id, index) => {
                  const p = tree.people[id];
                  return (
                    <React.Fragment key={id}>
                      {index > 0 || drillStack.length > 0 ? <ChevronRight className="w-3 h-3 text-slate-400" /> : null}
                      <button
                        onClick={() => handleDrillUp(index)}
                        className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium truncate max-w-[120px] cursor-pointer"
                      >
                        {p ? getPersonDisplayName(p) : 'Ancestor'}
                      </button>
                    </React.Fragment>
                  );
                })}
                {drillStack.length > 0 && <ChevronRight className="w-3 h-3 text-slate-400" />}
                <span className="font-semibold text-slate-900 dark:text-slate-200 truncate max-w-[160px]">
                  {rootPerson ? getPersonDisplayName(rootPerson) : 'Selected'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action / Close Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleExportPng}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-2xs cursor-pointer"
              title="Download high-resolution PNG image"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PNG</span>
            </button>
            <button
              onClick={handleExportSvg}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-2xs cursor-pointer"
              title="Download scalable SVG vector file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SVG</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close chart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Interactive Controls Bar */}
        <div className="px-4 py-2.5 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 text-xs">
          {/* Ancestor Level Slider & Stepper */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 whitespace-nowrap">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Ancestor Levels:</span>
              </span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setLevel((prev) => Math.max(1, prev - 1))}
                  disabled={level <= 1}
                  className="w-6 h-6 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-40 cursor-pointer"
                  title="Decrease generations"
                >
                  -
                </button>
                <span className="w-6 text-center font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                  {level}
                </span>
                <button
                  type="button"
                  onClick={() => setLevel((prev) => Math.min(8, prev + 1))}
                  disabled={level >= 8}
                  className="w-6 h-6 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-40 cursor-pointer"
                  title="Increase generations"
                >
                  +
                </button>
              </div>
            </div>

            <input
              type="range"
              min="1"
              max="8"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-24 sm:w-32 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              title={`Level ${level}: ${levelInfo.title}`}
            />

            <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:inline font-medium">
              {levelInfo.subtitle}
            </span>
          </div>

          {/* Chart Angle Mode, Color Theme & Zoom Controls */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Angle Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
              <button
                onClick={() => setAngleMode('360')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  angleMode === '360'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="Full 360° Sunburst Circle"
              >
                360° Sunburst
              </button>
              <button
                onClick={() => setAngleMode('180')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  angleMode === '180'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="180° Ancestor Fan Chart"
              >
                180° Fan
              </button>
            </div>

            {/* Dynamic Ring Sizing Toggle */}
            <button
              onClick={() => setFitNames((prev) => !prev)}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                fitNames
                  ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={fitNames ? 'Each ring is dynamically sized to fit the longest name in that generation (Click for uniform rings)' : 'Uniform ring sizing (Click to size rings to longest name)'}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
              <span>{fitNames ? 'Fit to Names: On' : 'Fit to Names: Off'}</span>
            </button>

            {/* Color Theme Selector */}
            <div className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
              <select
                value={colorTheme}
                onChange={(e) => setColorTheme(e.target.value as ColorThemeMode)}
                className="bg-slate-100 dark:bg-slate-800 border-none text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl py-1 px-2 cursor-pointer focus:ring-1 focus:ring-indigo-500"
                title="Color palette"
              >
                <option value="lineage">Palette: Lineage Quadrants</option>
                <option value="parchment">Palette: Antique Parchment</option>
                <option value="generation">Palette: By Generation</option>
                <option value="gender">Palette: By Gender</option>
              </select>
            </div>

            {/* Viewport Zoom Controls */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
              <button
                onClick={() => setZoom((prev) => Math.max(0.4, prev * 0.85))}
                className="p-1 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={resetViewport}
                className="p-1 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
                title="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom((prev) => Math.min(4.0, prev * 1.15))}
                className="p-1 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Canvas & Detail Sidebar Area */}
        <div className="flex-1 relative overflow-hidden bg-slate-50/50 dark:bg-slate-950/50 flex flex-col md:flex-row select-none">
          {/* SVG Sunburst Viewport */}
          <div
            className="flex-1 relative w-full h-full cursor-grab active:cursor-grabbing overflow-hidden flex items-center justify-center touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {layout ? (
              <svg
                ref={svgRef}
                viewBox={`${layout.bounds.minX} ${layout.bounds.minY} ${layout.bounds.width} ${layout.bounds.height}`}
                className="w-full h-full max-w-full max-h-full transition-transform duration-75"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
              >
                <defs>
                  {/* Subtle drop shadow filter for hovered arc */}
                  <filter id="sunburst-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366f1" floodOpacity="0.6" />
                  </filter>
                </defs>

                {/* Render concentric generation grid guides */}
                {(layout.ringRadii || []).map((ring) => (
                  <circle
                    key={`grid_${ring.generation}`}
                    r={ring.outerRadius}
                    cx="0"
                    cy="0"
                    fill="none"
                    stroke={
                      colorTheme === 'parchment'
                        ? (isDark ? 'rgba(107, 81, 59, 0.3)' : 'rgba(196, 171, 142, 0.5)')
                        : (isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.6)')
                    }
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />
                ))}

                {/* Ancestor Arc Slices */}
                {layout.nodes.map((node) => {
                  const isHighlighted = highlightedSlots.has(node.slotIndex);
                  const isSelected = selectedNode?.slotIndex === node.slotIndex;
                  const isFilled = Boolean(node.person);
                  const isHovered = hoveredNode?.slotIndex === node.slotIndex;

                  // Label display rules
                  // In outer rings (level >= 6), arc angle is small, only display name if space permits or hovered
                  const arcAngleDegrees = ((node.endAngle - node.startAngle) * 180) / Math.PI;
                  const canFitText = arcAngleDegrees > 7 || isHovered || isSelected;

                  const displayName = node.person ? getPersonDisplayName(node.person) : 'Unknown';
                  const lifeYears = node.person
                    ? `${node.person.birthDate ? node.person.birthDate.substring(0, 4) : ''}${
                        node.person.deathDate ? ` - ${node.person.deathDate.substring(0, 4)}` : node.person.isDeceased ? ' - †' : ''
                      }`
                    : '';

                  return (
                    <g
                      key={node.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node);
                      }}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className="cursor-pointer transition-opacity duration-150"
                      style={{
                        opacity: activeAhnentafel && !isHighlighted && !isHovered && !isSelected ? 0.38 : 1,
                      }}
                    >
                      {/* Arc Path */}
                      <path
                        d={node.pathD}
                        fill={node.fillColor}
                        stroke={
                          isSelected || isHovered
                            ? '#6366f1'
                            : isHighlighted
                            ? '#818cf8'
                            : node.strokeColor
                        }
                        strokeWidth={isSelected || isHovered ? 2.5 : isHighlighted ? 2 : 1}
                        strokeDasharray={!isFilled ? '3 3' : undefined}
                        filter={isHovered || isSelected ? 'url(#sunburst-glow)' : undefined}
                      />

                      {/* Label Text aligned along radius spoke */}
                      {canFitText && isFilled && (
                        <g
                          transform={`translate(${node.centroidX}, ${node.centroidY}) rotate(${node.labelAngleDeg})`}
                          pointerEvents="none"
                        >
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={node.textColor}
                            fontSize={Math.max(8, Math.min(12, 16 - level * 1.1))}
                            fontWeight={node.generation <= 2 ? '700' : '600'}
                            className="select-none font-sans"
                          >
                            {displayName.length > 36
                              ? displayName.substring(0, 34) + '…'
                              : displayName}
                          </text>

                          {/* Lifespan years for inner generations */}
                          {node.generation <= 3 && lifeYears.trim() && (
                            <text
                              textAnchor="middle"
                              dominantBaseline="central"
                              y={10}
                              fill={node.textColor}
                              fontSize={8}
                              opacity={0.8}
                              className="select-none font-sans font-normal"
                            >
                              {lifeYears}
                            </text>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Central Circle: Root Person */}
                {layout.rootNode.person && (
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      if (drillStack.length > 0) {
                        handleDrillUp();
                      } else {
                        setSelectedNode(null);
                        setHoveredNode(null);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <title>
                      {drillStack.length > 0 ? 'Click to navigate back up' : getPersonFullName(layout.rootNode.person)}
                    </title>
                    <circle
                      r={layout.rootNode.radius}
                      cx="0"
                      cy="0"
                      fill={layout.rootNode.fillColor}
                      stroke={drillStack.length > 0 ? '#6366f1' : layout.rootNode.strokeColor}
                      strokeWidth={drillStack.length > 0 ? 3 : 2}
                      className="transition-all hover:stroke-indigo-500"
                    />

                    {/* Central Person Information */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      y={-12}
                      fill={layout.rootNode.textColor}
                      fontSize={13}
                      fontWeight="700"
                      className="font-sans select-none pointer-events-none"
                    >
                      {getPersonDisplayName(layout.rootNode.person)}
                    </text>

                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      y={6}
                      fill={isDark ? '#94a3b8' : '#64748b'}
                      fontSize={10}
                      fontWeight="500"
                      className="font-sans select-none pointer-events-none"
                    >
                      {drillStack.length > 0 ? '↶ Drill Up' : 'Root Person'}
                    </text>

                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      y={20}
                      fill={isDark ? '#64748b' : '#94a3b8'}
                      fontSize={9}
                      className="font-sans select-none pointer-events-none"
                    >
                      {layout.rootNode.person.birthDate ? layout.rootNode.person.birthDate.substring(0, 4) : ''}
                      {layout.rootNode.person.deathDate ? ` - ${layout.rootNode.person.deathDate.substring(0, 4)}` : ''}
                    </text>
                  </g>
                )}
              </svg>
            ) : (
              <div className="text-slate-400 text-sm">No root person selected.</div>
            )}

            {/* Quick helper badge overlay */}
            <div className="absolute bottom-3 left-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shadow-2xs pointer-events-none">
              <Info className="w-3.5 h-3.5 text-indigo-500" />
              <span>Click any ancestor to inspect or drill down • Scroll to zoom</span>
            </div>
          </div>

          {/* Right Inspector Drawer (active upon hover or click) */}
          {activeDetailNode && (
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-4 flex flex-col justify-between overflow-y-auto max-h-64 md:max-h-full backdrop-blur-md">
              <div className="space-y-3">
                {/* Header with Ahnentafel Number and Title */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Ahnentafel #{activeDetailNode.slotIndex} • Gen {activeDetailNode.generation}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      {activeDetailNode.relationshipTitle}
                    </h3>
                  </div>
                  {selectedNode && (
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                      title="Clear selection"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Person details if known */}
                {inspectedPerson ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-200 dark:border-indigo-800 flex-shrink-0">
                        {((inspectedPerson.firstName || '')[0] || '') + ((inspectedPerson.lastName || '')[0] || '') || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs truncate">
                          {getPersonFullName(inspectedPerson)}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 capitalize">
                          Gender: {inspectedPerson.gender || 'Unspecified'}
                        </div>
                      </div>
                    </div>

                    {/* Vital details */}
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>
                          <strong>Born:</strong> {inspectedPerson.birthDate || 'Unknown date'}
                        </span>
                      </div>
                      {inspectedPerson.birthPlace && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">
                            <strong>Place:</strong> {inspectedPerson.birthPlace}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>
                          <strong>Died:</strong>{' '}
                          {inspectedPerson.deathDate || (inspectedPerson.isDeceased ? 'Deceased' : 'Living / Unknown')}
                        </span>
                      </div>
                      {inspectedPerson.deathPlace && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">
                            <strong>Place:</strong> {inspectedPerson.deathPlace}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                      <HelpCircle className="w-4 h-4 text-amber-500" />
                      <span>Unrecorded Ancestor</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      This position in the pedigree has not been added to your tree yet.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {inspectedPerson && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 mt-3">
                  <button
                    onClick={() => handleDrillDown(inspectedPerson.id)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    title="Center sunburst chart on this ancestor and show their pedigree"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Focus Ancestors (Drill Down)</span>
                  </button>

                  <button
                    onClick={() => handleJumpToPerson(inspectedPerson.id)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                    title="Select this person on the main family tree canvas"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View in Tree Canvas</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
