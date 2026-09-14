import React, { useEffect, useRef } from 'react';
import { GitFork, XCircle, Users } from 'lucide-react';

interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  selectedCount: number;
  onCreateNewTree: () => void;
  onDeselectAll: () => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  x,
  y,
  selectedCount,
  onCreateNewTree,
  onDeselectAll,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Use capture phase on mousedown to ensure it triggers before canvas handlers
    window.addEventListener('mousedown', handleClickOutside, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Viewport clamping
  const menuWidth = 230;
  const menuHeight = 130;
  const adjustedX = Math.min(Math.max(8, x), window.innerWidth - menuWidth - 8);
  const adjustedY = Math.min(Math.max(8, y), window.innerHeight - menuHeight - 8);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
        zIndex: 9999,
      }}
      className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-2xl py-1.5 min-w-[220px] text-xs animate-in fade-in zoom-in-95 duration-150 select-none overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="px-3.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Users className="w-3 h-3 text-slate-400" />
          <span>
            {selectedCount} {selectedCount === 1 ? 'person' : 'people'} selected
          </span>
        </span>
      </div>

      {/* Main Action: Create new tree */}
      <div className="p-1">
        <button
          onClick={() => {
            onClose();
            onCreateNewTree();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-indigo-50/80 text-slate-800 hover:text-indigo-700 transition-colors group text-left cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
            <GitFork className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold leading-snug text-slate-900 group-hover:text-indigo-600">
              Create new tree
            </div>
            <div className="text-[10px] text-slate-400 group-hover:text-indigo-500 leading-snug">
              Extract selection into new tree
            </div>
          </div>
        </button>
      </div>

      {/* Secondary Actions */}
      <div className="border-t border-slate-100 p-1">
        <button
          onClick={() => {
            onClose();
            onDeselectAll();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors text-left cursor-pointer"
        >
          <XCircle className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px]">Deselect all</span>
        </button>
      </div>
    </div>
  );
};
