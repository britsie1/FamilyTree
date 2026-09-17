import React, { useRef, useState, useCallback } from 'react';
import type { LayoutNode, TreeLayout } from '../../types/tree';
import { MapPin, Minimize2 } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';

interface MiniMapProps {
  layout: TreeLayout;
  pan: { x: number; y: number };
  zoom: number;
  containerWidth: number;
  containerHeight: number;
  onPanChange: (newPan: { x: number; y: number }) => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

const MAP_WIDTH = 220;
const MAP_HEIGHT = 140;
const PADDING = 12;

export const MiniMap: React.FC<MiniMapProps> = ({
  layout,
  pan,
  zoom,
  containerWidth,
  containerHeight,
  onPanChange,
  isOpen = true,
  onToggleOpen,
}) => {
  const [isDraggingViewport, setIsDraggingViewport] = useState(false);
  const mapRef = useRef<SVGSVGElement | null>(null);
  const isDark = useThemeStore((s) => s.isDark);

  const bounds = layout.bounds;
  const contentWidth = Math.max(bounds.width, 1000);
  const contentHeight = Math.max(bounds.height, 700);

  const availableW = MAP_WIDTH - PADDING * 2;
  const availableH = MAP_HEIGHT - PADDING * 2;

  const scale = Math.min(availableW / contentWidth, availableH / contentHeight);
  const offsetX = PADDING + (availableW - contentWidth * scale) / 2;
  const offsetY = PADDING + (availableH - contentHeight * scale) / 2;

  // Viewport world coordinates
  const worldViewportMinX = -pan.x / zoom;
  const worldViewportMinY = -pan.y / zoom;
  const worldViewportWidth = containerWidth / zoom;
  const worldViewportHeight = containerHeight / zoom;

  // Map viewport to MiniMap coordinates
  const viewportBoxX = offsetX + (worldViewportMinX - bounds.minX) * scale;
  const viewportBoxY = offsetY + (worldViewportMinY - bounds.minY) * scale;
  const viewportBoxW = worldViewportWidth * scale;
  const viewportBoxH = worldViewportHeight * scale;

  // Pan canvas so a given world coordinate is at the center of the screen
  const centerOnWorldCoord = useCallback(
    (worldX: number, worldY: number) => {
      const newPanX = containerWidth / 2 - worldX * zoom;
      const newPanY = containerHeight / 2 - worldY * zoom;
      onPanChange({ x: newPanX, y: newPanY });
    },
    [containerWidth, containerHeight, zoom, onPanChange]
  );

  // Convert click in MiniMap coordinates to world coordinates and center canvas
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDraggingViewport || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const clickMapX = e.clientX - rect.left;
    const clickMapY = e.clientY - rect.top;

    const targetWorldX = (clickMapX - offsetX) / scale + bounds.minX;
    const targetWorldY = (clickMapY - offsetY) / scale + bounds.minY;

    centerOnWorldCoord(targetWorldX, targetWorldY);
  };

  const handleViewportMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingViewport(true);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startPanX = pan.x;
    const startPanY = pan.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dxScreen = moveEvent.clientX - startClientX;
      const dyScreen = moveEvent.clientY - startClientY;

      // Moving the box by dx in minimap corresponds to dx / scale in world space
      // In pan coordinates: pan = -world * zoom, so dPan = -(dx / scale) * zoom
      const dPanX = -(dxScreen / scale) * zoom;
      const dPanY = -(dyScreen / scale) * zoom;

      onPanChange({
        x: startPanX + dPanX,
        y: startPanY + dPanY,
      });
    };

    const handleMouseUp = () => {
      setIsDraggingViewport(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggleOpen}
        className="fixed bottom-6 right-6 z-30 bg-white/95 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-white p-2.5 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700/60 backdrop-blur-md transition-all hover:scale-105 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
        title="Show Radar MiniMap"
      >
        <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span className="hidden sm:inline">MiniMap</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-30 bg-white/95 dark:bg-slate-900/90 text-slate-800 dark:text-white backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden flex flex-col select-none animate-in fade-in zoom-in-95 duration-200">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Radar Navigator</span>
        </div>
        <button
          onClick={onToggleOpen}
          className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
          title="Minimize MiniMap"
        >
          <Minimize2 className="w-3 h-3" />
        </button>
      </div>

      {/* SVG Canvas Map */}
      <svg
        ref={mapRef}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        onClick={handleMapClick}
        className="cursor-crosshair bg-slate-100/70 dark:bg-slate-950/70"
      >
        {/* Subtle grid pattern */}
        <defs>
          <pattern
            id="minimap-grid"
            width={20}
            height={20}
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke={isDark ? '#334155' : '#cbd5e1'}
              strokeWidth={0.5}
              strokeOpacity={isDark ? 0.4 : 0.6}
            />
          </pattern>
        </defs>
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#minimap-grid)" />

        {/* Scaled Mini Nodes */}
        {Object.values(layout.nodes).map((node: LayoutNode) => {
          const nx = offsetX + (node.x - bounds.minX) * scale;
          const ny = offsetY + (node.y - bounds.minY) * scale;
          const nw = Math.max(node.width * scale, 3.5);
          const nh = Math.max(node.height * scale, 2.5);

          const gender = node.data.gender;
          const fillColor = isDark
            ? gender === 'male'
              ? '#60a5fa' // blue-400
              : gender === 'female'
              ? '#f472b6' // rose-400
              : '#a78bfa' // violet-400
            : gender === 'male'
            ? '#3b82f6' // blue-500
            : gender === 'female'
            ? '#ec4899' // pink-500
            : '#8b5cf6'; // violet-500

          return (
            <rect
              key={`mm_${node.id}`}
              x={nx}
              y={ny}
              width={nw}
              height={nh}
              rx={1.5}
              fill={fillColor}
              opacity={0.85}
            />
          );
        })}

        {/* Viewport Boundary Frame (Draggable) */}
        <rect
          x={viewportBoxX}
          y={viewportBoxY}
          width={Math.max(viewportBoxW, 6)}
          height={Math.max(viewportBoxH, 6)}
          fill="#6366f1"
          fillOpacity={isDark ? 0.18 : 0.12}
          stroke={isDark ? '#818cf8' : '#4f46e5'}
          strokeWidth={1.5}
          rx={3}
          className={`transition-colors ${
            isDraggingViewport
              ? 'cursor-grabbing stroke-indigo-400 dark:stroke-indigo-300'
              : 'cursor-grab hover:stroke-indigo-600 dark:hover:stroke-indigo-400'
          }`}
          onMouseDown={handleViewportMouseDown}
        />
      </svg>
    </div>
  );
};
