import React, { useEffect, useRef } from 'react';
import { GitFork, XCircle, Users, Link2, Compass, Activity, HeartHandshake } from 'lucide-react';

interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  selectedCount: number;
  onCreateNewTree: () => void;
  onLinkExistingTree?: () => void;
  onOpenSunburst?: () => void;
  onCalculateKinship?: () => void;
  onOpenStatistics?: () => void;
  onDeselectAll: () => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  x,
  y,
  selectedCount,
  onCreateNewTree,
  onLinkExistingTree,
  onOpenSunburst,
  onCalculateKinship,
  onOpenStatistics,
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
      className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl py-1.5 min-w-[220px] text-xs animate-in fade-in zoom-in-95 duration-150 select-none overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="px-3.5 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span>
            {selectedCount} {selectedCount === 1 ? 'person' : 'people'} selected
          </span>
        </span>
      </div>

      {/* Main Action: Create new tree */}
      <div className="p-1 space-y-1">
        <button
          onClick={() => {
            onClose();
            onCreateNewTree();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-indigo-50/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors group text-left cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
            <GitFork className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold leading-snug text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              Create new tree
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 leading-snug">
              Extract selection into new tree
            </div>
          </div>
        </button>

        {onLinkExistingTree && selectedCount === 1 && (
          <button
            onClick={() => {
              onClose();
              onLinkExistingTree();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-indigo-50/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors group text-left cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors flex-shrink-0">
              <Link2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold leading-snug text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                Link existing tree...
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 leading-snug">
                Connect to person on another tree
              </div>
            </div>
          </button>
        )}

        {onOpenSunburst && selectedCount === 1 && (
          <button
            onClick={() => {
              onClose();
              onOpenSunburst();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-indigo-50/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors group text-left cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors flex-shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold leading-snug text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400">
                Ancestor Sunburst
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 leading-snug">
                Radial multi-generation ancestor chart
              </div>
            </div>
          </button>
        )}

        {onCalculateKinship && selectedCount === 1 && (
          <button
            onClick={() => {
              onClose();
              onCalculateKinship();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-indigo-50/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors group text-left cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-pink-100 dark:bg-pink-950/80 text-pink-600 dark:text-pink-400 flex items-center justify-center group-hover:bg-pink-600 group-hover:text-white transition-colors flex-shrink-0">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold leading-snug text-slate-900 dark:text-white group-hover:text-pink-700 dark:group-hover:text-pink-400">
                Calculate Kinship...
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-pink-600 dark:group-hover:text-pink-400 leading-snug">
                Kinship degree & relationship path
              </div>
            </div>
          </button>
        )}

        {onOpenStatistics && (
          <button
            onClick={() => {
              onClose();
              onOpenStatistics();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-indigo-50/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors group text-left cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold leading-snug text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-400">
                Tree Health & Stats
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 leading-snug">
                Data quality audit & demographics
              </div>
            </div>
          </button>
        )}
      </div>


      {/* Secondary Actions */}
      <div className="border-t border-slate-100 dark:border-slate-800 p-1">
        <button
          onClick={() => {
            onClose();
            onDeselectAll();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-left cursor-pointer"
        >
          <XCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="text-[11px]">Deselect all</span>
        </button>
      </div>
    </div>
  );
};
