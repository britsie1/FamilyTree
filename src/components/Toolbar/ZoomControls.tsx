import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToScreen: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-30 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-2xl shadow-xl border border-slate-200/80 select-none">
      <button
        onClick={onZoomOut}
        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
        title="Zoom Out (Ctrl + Scroll Down)"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <button
        onClick={onResetZoom}
        className="px-2 py-1 text-xs font-mono font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        title="Click to reset zoom to 100%"
      >
        {Math.round(zoom * 100)}%
      </button>

      <button
        onClick={onZoomIn}
        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
        title="Zoom In (Ctrl + Scroll Up)"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-slate-200 mx-1" />

      <button
        onClick={onFitToScreen}
        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
        title="Fit entire family tree into view"
      >
        <Maximize2 className="w-4 h-4" />
      </button>

      <button
        onClick={onResetZoom}
        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
        title="Reset pan and zoom to origin"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
};
