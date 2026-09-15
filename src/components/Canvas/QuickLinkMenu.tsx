import React, { useEffect, useRef } from 'react';
import type { TreeData } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import { Baby, ArrowUp, Heart, Users, X } from 'lucide-react';

export type QuickLinkType = 'child' | 'parent' | 'partner' | 'sibling';

interface QuickLinkMenuProps {
  tree: TreeData;
  sourcePersonId: string;
  targetPersonId: string;
  position: { x: number; y: number }; // Screen client coordinates
  onLink: (type: QuickLinkType) => void;
  onClose: () => void;
}

export const QuickLinkMenu: React.FC<QuickLinkMenuProps> = ({
  tree,
  sourcePersonId,
  targetPersonId,
  position,
  onLink,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  const sourcePerson = tree.people[sourcePersonId];
  const targetPerson = tree.people[targetPersonId];

  const sourceName = getPersonDisplayName(sourcePerson);
  const targetName = getPersonDisplayName(targetPerson);

  // Close when clicking outside
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleDown);
    return () => window.removeEventListener('mousedown', handleDown);
  }, [onClose]);

  // Adjust menu position so it stays within viewport
  const menuWidth = 260;
  const menuHeight = 170;
  const left = Math.min(Math.max(16, position.x - menuWidth / 2), window.innerWidth - menuWidth - 16);
  const top = Math.min(Math.max(16, position.y - menuHeight / 2), window.innerHeight - menuHeight - 16);

  return (
    <div
      ref={menuRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      className="fixed z-50 w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-3.5 flex flex-col gap-2.5 animate-in zoom-in-95 duration-150 select-none text-slate-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="text-xs font-bold text-slate-900 truncate pr-2">
          <span>Connect Relationship</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Target prompt */}
      <div className="text-[11px] text-slate-600 leading-tight">
        Link <strong>{targetName}</strong> to <strong>{sourceName}</strong> as:
      </div>

      {/* 2x2 Grid of Quick Actions */}
      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
        <button
          onClick={() => onLink('child')}
          className="flex items-center gap-2 p-2 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/90 text-indigo-700 font-semibold text-xs transition-colors text-left border border-indigo-200/60 cursor-pointer"
        >
          <Baby className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span>Child</span>
        </button>

        <button
          onClick={() => onLink('parent')}
          className="flex items-center gap-2 p-2 rounded-xl bg-sky-50/70 hover:bg-sky-100/90 text-sky-700 font-semibold text-xs transition-colors text-left border border-sky-200/60 cursor-pointer"
        >
          <ArrowUp className="w-4 h-4 text-sky-600 flex-shrink-0" />
          <span>Parent</span>
        </button>

        <button
          onClick={() => onLink('partner')}
          className="flex items-center gap-2 p-2 rounded-xl bg-rose-50/70 hover:bg-rose-100/90 text-rose-700 font-semibold text-xs transition-colors text-left border border-rose-200/60 cursor-pointer"
        >
          <Heart className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>Spouse</span>
        </button>

        <button
          onClick={() => onLink('sibling')}
          className="flex items-center gap-2 p-2 rounded-xl bg-amber-50/70 hover:bg-amber-100/90 text-amber-700 font-semibold text-xs transition-colors text-left border border-amber-200/60 cursor-pointer"
        >
          <Users className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>Sibling</span>
        </button>
      </div>
    </div>
  );
};
