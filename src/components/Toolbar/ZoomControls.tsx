import React from 'react';
import type { LayoutStyle } from '../../types/tree';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  ArrowDown,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Users,
  Clock,
  Map,
} from 'lucide-react';

interface ZoomControlsProps {
  // Zoom & Pan
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToScreen: () => void;

  // Layout Controls
  layoutStyle: LayoutStyle;
  onToggleLayoutStyle: () => void;
  onResetLayout: () => void;
  groupByFamily?: boolean;
  onToggleGroupByFamily?: () => void;
  adjustSpacing?: boolean;
  onToggleAdjustSpacing?: () => void;

  // MiniMap Navigator
  isMiniMapOpen?: boolean;
  onToggleMiniMap?: () => void;

  // 4D Timeline
  isTimelineActive?: boolean;
  onToggleTimeline?: () => void;
  temporalYear?: number | null;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  layoutStyle,
  onToggleLayoutStyle,
  onResetLayout,
  groupByFamily = false,
  onToggleGroupByFamily,
  adjustSpacing = true,
  onToggleAdjustSpacing,
  isMiniMapOpen = true,
  onToggleMiniMap,
  isTimelineActive = false,
  onToggleTimeline,
  temporalYear,
}) => {
  return (
    <aside
      aria-label="Canvas and View Controls"
      className={`fixed z-30 transition-all duration-200 select-none ${
        isTimelineActive
          ? 'bottom-28 sm:bottom-32 left-1/2 -translate-x-1/2 max-w-[96vw]'
          : 'bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 max-w-[96vw]'
      }`}
    >
      <div className="flex items-center gap-1 sm:gap-1.5 bg-white/95 backdrop-blur-md px-2 sm:px-2.5 py-1.5 rounded-2xl shadow-xl border border-slate-200/90 overflow-x-auto max-w-full">
        {/* Toggle Layout: Top-Down vs Left-to-Right */}
        <button
          onClick={onToggleLayoutStyle}
          title={
            layoutStyle === 'horizontal'
              ? 'Left-to-Right layout active. Click for Top-Down.'
              : 'Top-Down layout active. Click for Left-to-Right.'
          }
          className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex-shrink-0 ${
            layoutStyle === 'horizontal'
              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-300 shadow-2xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
          }`}
        >
          {layoutStyle === 'horizontal' ? (
            <>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline">Left-to-Right</span>
              <span className="md:hidden">L-to-R</span>
            </>
          ) : (
            <>
              <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">Top-Down</span>
              <span className="md:hidden">Top-Down</span>
            </>
          )}
        </button>

        {/* Auto-Tidy */}
        <button
          onClick={onResetLayout}
          title="Auto-organize layout to default positions"
          className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-xl text-xs font-medium border border-slate-200 transition-colors cursor-pointer flex-shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span className="hidden md:inline">Auto-Tidy</span>
        </button>

        {/* Adjust Spacing */}
        {onToggleAdjustSpacing && (
          <button
            onClick={onToggleAdjustSpacing}
            title={
              adjustSpacing
                ? 'Adjust Spacing is ON. Click to switch to uniform spacing.'
                : 'Click to adjust tree spacing based on generation width.'
            }
            className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer flex-shrink-0 ${
              adjustSpacing
                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-300 shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
          >
            <SlidersHorizontal className={`w-3.5 h-3.5 ${adjustSpacing ? 'text-indigo-600' : 'text-slate-500'}`} />
            <span className="hidden lg:inline">Adjust Spacing</span>
            {adjustSpacing && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
          </button>
        )}

        {/* Group Families */}
        {onToggleGroupByFamily && (
          <button
            onClick={onToggleGroupByFamily}
            title={
              groupByFamily
                ? 'Group Families is ON. Click to disable separation gap.'
                : 'Click to visually group and space apart family branches.'
            }
            className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer flex-shrink-0 ${
              groupByFamily
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
          >
            <Users className={`w-3.5 h-3.5 ${groupByFamily ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span className="hidden lg:inline">Group Families</span>
            {groupByFamily && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>
        )}

        {/* 4D Timeline */}
        {onToggleTimeline && (
          <button
            onClick={onToggleTimeline}
            title={
              isTimelineActive
                ? `4D Timeline is Active (Year ${temporalYear}). Click to close.`
                : 'Launch 4D Temporal Scrub Bar ("Who Was in the Room?").'
            }
            className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex-shrink-0 ${
              isTimelineActive
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${isTimelineActive ? 'text-slate-950 animate-pulse' : 'text-amber-600'}`} />
            <span className="hidden md:inline">4D Timeline</span>
            {isTimelineActive && temporalYear && (
              <span className="font-mono text-[10px] bg-slate-950/20 px-1 py-0.2 rounded">
                {temporalYear}
              </span>
            )}
          </button>
        )}

        {/* Divider between layout tools and zoom tools */}
        <div className="w-px h-4 bg-slate-200 mx-0.5 flex-shrink-0" />

        {/* Zoom Out */}
        <button
          onClick={onZoomOut}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          title="Zoom Out (Ctrl + Scroll Down)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Percentage */}
        <button
          onClick={onResetZoom}
          className="px-1.5 py-0.5 text-xs font-mono font-medium text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer flex-shrink-0"
          title="Reset zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>

        {/* Zoom In */}
        <button
          onClick={onZoomIn}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          title="Zoom In (Ctrl + Scroll Up)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {/* Small Divider */}
        <div className="w-px h-3.5 bg-slate-200 mx-0.5 flex-shrink-0" />

        {/* Fit To Screen */}
        <button
          onClick={onFitToScreen}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          title="Fit entire family tree into view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Toggle MiniMap Radar Navigator */}
        {onToggleMiniMap && (
          <button
            onClick={onToggleMiniMap}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0 ${
              isMiniMapOpen
                ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title={isMiniMapOpen ? 'Hide MiniMap radar navigator' : 'Show MiniMap radar navigator'}
          >
            <Map className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Reset Pan & Zoom */}
        <button
          onClick={onResetZoom}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          title="Reset pan and zoom to origin"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
