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
  Layers,
  X,
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
  const [isMobileOptionsOpen, setIsMobileOptionsOpen] = React.useState(false);

  return (
    <aside
      aria-label="Canvas and View Controls"
      className={`fixed z-30 transition-all duration-200 select-none ${
        isTimelineActive
          ? 'bottom-28 sm:bottom-32 left-3 sm:left-6 max-w-[calc(100vw-1.5rem)]'
          : 'bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 left-3 sm:left-6 max-w-[calc(100vw-1.5rem)]'
      }`}
    >
      {/* Mobile Compact Controls (< sm) */}
      <div className="flex sm:hidden flex-col gap-2">
        {/* Mobile View Options Popover */}
        {isMobileOptionsOpen && (
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col gap-2 w-56 animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                View & Layout
              </span>
              <button
                onClick={() => setIsMobileOptionsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <button
                onClick={() => {
                  onToggleLayoutStyle();
                  setIsMobileOptionsOpen(false);
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {layoutStyle === 'horizontal' ? (
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  )}
                  <span>Layout</span>
                </span>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 rounded-full">
                  {layoutStyle === 'horizontal' ? 'Left-to-Right' : 'Top-Down'}
                </span>
              </button>

              <button
                onClick={() => {
                  onResetLayout();
                  setIsMobileOptionsOpen(false);
                }}
                className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Auto-Tidy Tree</span>
              </button>

              {onToggleAdjustSpacing && (
                <button
                  onClick={onToggleAdjustSpacing}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Adjust Spacing</span>
                  </span>
                  <span className={`w-2 h-2 rounded-full ${adjustSpacing ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`} />
                </button>
              )}

              {onToggleGroupByFamily && (
                <button
                  onClick={onToggleGroupByFamily}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Group Families</span>
                  </span>
                  <span className={`w-2 h-2 rounded-full ${groupByFamily ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'}`} />
                </button>
              )}

              {onToggleTimeline && (
                <button
                  onClick={() => {
                    onToggleTimeline();
                    setIsMobileOptionsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl font-semibold cursor-pointer ${
                    isTimelineActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>4D Timeline</span>
                  </span>
                  {isTimelineActive && temporalYear && (
                    <span className="text-[10px] bg-slate-950/20 px-1.5 py-0.5 rounded font-mono">
                      {temporalYear}
                    </span>
                  )}
                </button>
              )}

              {onToggleMiniMap && (
                <button
                  onClick={onToggleMiniMap}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Map className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>MiniMap Radar</span>
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isMiniMapOpen ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Floating Mobile Pill Bar */}
        <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-slate-200/90 dark:border-slate-800">
          <button
            onClick={onZoomOut}
            className="w-9 h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={onResetZoom}
            className="px-2 py-1 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            title="Reset Zoom"
            aria-label="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            className="w-9 h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <button
            onClick={onFitToScreen}
            className="w-9 h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Fit to Screen"
            aria-label="Fit to Screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMobileOptionsOpen((prev) => !prev)}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
              isMobileOptionsOpen || isTimelineActive
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700'
            }`}
            title="View & Layout Options"
            aria-label="View & Layout Options"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop Toolbar (>= sm) */}
      <div className="hidden sm:flex items-center gap-1 sm:gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2 sm:px-2.5 py-1.5 rounded-2xl shadow-xl border border-slate-200/90 dark:border-slate-800 overflow-x-auto max-w-full">
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
              ? 'bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 shadow-2xs'
              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
          }`}
        >
          {layoutStyle === 'horizontal' ? (
            <>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden md:inline">Left-to-Right</span>
              <span className="md:hidden">L-to-R</span>
            </>
          ) : (
            <>
              <ArrowDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden md:inline">Top-Down</span>
              <span className="md:hidden">Top-Down</span>
            </>
          )}
        </button>

        {/* Auto-Tidy */}
        <button
          onClick={onResetLayout}
          title="Auto-organize layout to default positions"
          className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex-shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
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
                ? 'bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <SlidersHorizontal className={`w-3.5 h-3.5 ${adjustSpacing ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
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
                ? 'bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Users className={`w-3.5 h-3.5 ${groupByFamily ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`} />
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
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${isTimelineActive ? 'text-slate-950 animate-pulse' : 'text-amber-600 dark:text-amber-400'}`} />
            <span className="hidden md:inline">4D Timeline</span>
            {isTimelineActive && temporalYear && (
              <span className="font-mono text-[10px] bg-slate-950/20 px-1 py-0.2 rounded">
                {temporalYear}
              </span>
            )}
          </button>
        )}

        {/* Divider between layout tools and zoom tools */}
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5 flex-shrink-0" />

        {/* Zoom Out */}
        <button
          onClick={onZoomOut}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          title="Zoom Out (Ctrl + Scroll Down)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Percentage */}
        <button
          onClick={onResetZoom}
          className="px-1.5 py-0.5 text-xs font-mono font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer flex-shrink-0"
          title="Reset zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>

        {/* Zoom In */}
        <button
          onClick={onZoomIn}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          title="Zoom In (Ctrl + Scroll Up)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {/* Small Divider */}
        <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5 flex-shrink-0" />

        {/* Fit To Screen */}
        <button
          onClick={onFitToScreen}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex-shrink-0"
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
                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/70'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={isMiniMapOpen ? 'Hide MiniMap radar navigator' : 'Show MiniMap radar navigator'}
          >
            <Map className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Reset Pan & Zoom */}
        <button
          onClick={onResetZoom}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          title="Reset pan and zoom to origin"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
