import React from 'react';
import { Target, X, GitFork, Eye, Copy } from 'lucide-react';
import type { TreeData } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { useModalStore } from '../../stores/useModalStore';

export interface TreeOverlaysProps {
  tree: TreeData;
  onMakeCopy: () => void;
  onFitToScreen: () => void;
}

export const TreeOverlays: React.FC<TreeOverlaysProps> = ({
  tree,
  onMakeCopy,
  onFitToScreen,
}) => {
  const isReadOnly = useCollabStore((s) => s.userPermission === 'viewer');
  const focusPersonId = useCanvasStore((s) => s.focusPersonId);
  const clearFocus = useCanvasStore((s) => s.clearFocus);
  const selectedPersonIds = useCanvasStore((s) => s.selectedPersonIds);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const openCreateTreeModal = useModalStore((s) => s.openCreateTreeModal);

  return (
    <>
      {/* View-Only Mode Banner */}
      {isReadOnly && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 backdrop-blur-md px-3 sm:px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 sm:gap-3.5 z-40 text-xs animate-in slide-in-from-top duration-200 border border-amber-400 font-medium max-w-[calc(100vw-2rem)]">
          <div className="flex items-center gap-1.5 font-bold truncate">
            <Eye className="w-4 h-4 text-slate-950 flex-shrink-0" />
            <span className="truncate">View-Only access.</span>
          </div>
          <button
            onClick={onMakeCopy}
            className="bg-slate-950 hover:bg-slate-900 text-white px-2.5 sm:px-3 py-1 rounded-xl text-[11px] font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer hover:scale-105 flex-shrink-0"
          >
            <Copy className="w-3.5 h-3.5 text-amber-400" />
            <span>Make Copy</span>
          </button>
        </div>
      )}

      {/* Floating Focus Mode Banner */}
      {focusPersonId && tree.people[focusPersonId] && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-900/90 text-white backdrop-blur-md px-3 sm:px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 sm:gap-3 z-40 text-xs animate-in slide-in-from-top duration-200 border border-indigo-700/50 max-w-[calc(100vw-2rem)]">
          <div className="flex items-center gap-1.5 truncate">
            <Target className="w-4 h-4 text-indigo-300 flex-shrink-0" />
            <span className="truncate">
              Focus: <strong>{getPersonDisplayName(tree.people[focusPersonId])}</strong>
            </span>
          </div>
          <button
            onClick={() => {
              clearFocus();
              setTimeout(onFitToScreen, 60);
            }}
            className="bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors flex items-center gap-1 text-white shadow-xs flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Full Tree</span>
          </button>
        </div>
      )}

      {/* Multi-Selection HUD */}
      {selectedPersonIds.size > 1 && (
        <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white backdrop-blur-md px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 sm:gap-3.5 z-40 text-xs border border-slate-700/60 animate-in slide-in-from-bottom-3 duration-200 max-w-[calc(100vw-2rem)]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="font-semibold text-slate-100 whitespace-nowrap">
              {selectedPersonIds.size} selected
            </span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={openCreateTreeModal}
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer hover:scale-105 whitespace-nowrap"
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Create tree</span>
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
    </>
  );
};
