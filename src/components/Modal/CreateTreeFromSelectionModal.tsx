import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { TreeData } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import { X, GitFork, Check, Users, ArrowRight } from 'lucide-react';

interface CreateTreeFromSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tree: TreeData;
  selectedPersonIds: string[];
  onCreateTree: (name: string, switchImmediately: boolean) => void;
}

export const CreateTreeFromSelectionModal: React.FC<CreateTreeFromSelectionModalProps> = ({
  isOpen,
  onClose,
  tree,
  selectedPersonIds,
  onCreateTree,
}) => {
  const [customName, setCustomName] = useState<string | null>(null);
  const [switchImmediately, setSwitchImmediately] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute suggested default name derived directly from selected people
  const suggestedName = useMemo(() => {
    const selectedPeople = selectedPersonIds
      .map((id) => tree.people[id])
      .filter(Boolean);

    const surnames = selectedPeople
      .map((p) => p.lastName?.trim())
      .filter(Boolean);

    const uniqueSurnames = Array.from(new Set(surnames));
    if (uniqueSurnames.length === 1 && uniqueSurnames[0]) {
      return `${uniqueSurnames[0]} Family Tree`;
    }
    return `${tree.name || 'Family Tree'} (Branch)`;
  }, [selectedPersonIds, tree]);

  const treeName = customName ?? suggestedName;

  // Auto-focus and select input after modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!treeName.trim()) return;
    onCreateTree(treeName.trim(), switchImmediately);
    setCustomName(null);
    onClose();
  };

  const selectedPeople = selectedPersonIds
    .map((id) => tree.people[id])
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Create New Tree from Selection</h2>
              <p className="text-xs text-slate-500">
                {selectedPeople.length} {selectedPeople.length === 1 ? 'person' : 'people'} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Informational Callout */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3.5 text-xs text-indigo-900 flex items-start gap-3">
            <Users className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Independent Tree Extraction: </span>
              A new family tree will be created with the selected members. All marriages, unions,
              and parent-child connections between them will be preserved.
            </div>
          </div>

          {/* Tree Name Input */}
          <div>
            <label htmlFor="newTreeName" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              New Tree Name
            </label>
            <input
              ref={inputRef}
              id="newTreeName"
              type="text"
              value={treeName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Miller Family Branch"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all shadow-inner"
              required
            />
          </div>

          {/* Selected Members Chips */}
          <div>
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Included Members ({selectedPeople.length})</span>
            </div>
            <div className="max-h-36 overflow-y-auto border border-slate-100 bg-slate-50/60 rounded-2xl p-2.5 flex flex-wrap gap-2">
              {selectedPeople.map((person) => {
                const displayName = getPersonDisplayName(person);
                const initial = (displayName[0] || '?').toUpperCase();
                return (
                  <div
                    key={person.id}
                    className="inline-flex items-center gap-2 bg-white border border-slate-200/80 px-2.5 py-1 rounded-xl shadow-xs text-xs text-slate-700"
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">
                      {initial}
                    </div>
                    <span className="font-medium truncate max-w-[140px]">{displayName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Switch Immediately Checkbox */}
          <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={switchImmediately}
              onChange={(e) => setSwitchImmediately(e.target.checked)}
              className="w-4 h-4 rounded-md text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <span className="text-xs font-medium text-slate-700">
              Switch to this new tree immediately
            </span>
          </label>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!treeName.trim()}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Create Tree</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>
      </div>
    </div>
  );
};
