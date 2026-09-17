import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { TreeData } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import { X, GitFork, Check, Users, ArrowRight, Link2, MoveRight, Copy, Cloud } from 'lucide-react';

export interface CreateTreeOptions {
  name: string;
  switchImmediately: boolean;
  removeMovedFromSource: boolean;
  linkTrees: boolean;
  bridgePersonId: string;
}

interface CreateTreeFromSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tree: TreeData;
  selectedPersonIds: string[];
  isCloudTree?: boolean;
  onCreateTree: (options: CreateTreeOptions) => void | Promise<void>;
}

export const CreateTreeFromSelectionModal: React.FC<CreateTreeFromSelectionModalProps> = ({
  isOpen,
  onClose,
  tree,
  selectedPersonIds,
  isCloudTree = false,
  onCreateTree,
}) => {
  const [customName, setCustomName] = useState<string | null>(null);
  const [switchImmediately, setSwitchImmediately] = useState(true);
  const [branchMode, setBranchMode] = useState<'move' | 'copy'>('move');
  const [linkTrees, setLinkTrees] = useState(true);
  const [selectedBridgePersonId, setSelectedBridgePersonId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const bridgePersonId =
    selectedBridgePersonId && selectedPersonIds.includes(selectedBridgePersonId)
      ? selectedBridgePersonId
      : selectedPersonIds[0] ?? '';

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
    onCreateTree({
      name: treeName.trim(),
      switchImmediately,
      removeMovedFromSource: branchMode === 'move',
      linkTrees,
      bridgePersonId: bridgePersonId || selectedPersonIds[0] || '',
    });
    setCustomName(null);
    onClose();
  };

  const selectedPeople = selectedPersonIds
    .map((id) => tree.people[id])
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Create New Tree from Selection</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedPeople.length} {selectedPeople.length === 1 ? 'person' : 'people'} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Informational Callout */}
          <div className="bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-3.5 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Independent Tree Extraction: </span>
              A new family tree will be created with the selected members. All marriages, unions,
              and parent-child connections between them will be preserved.
            </div>
          </div>

          {isCloudTree && (
            <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-2xl p-3 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2.5">
              <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span>
                <strong>Cloud Tree Branch:</strong> This new tree will be created in your cloud account, preserving URL parameters and real-time syncing.
              </span>
            </div>
          )}

          {/* Tree Name Input */}
          <div>
            <label htmlFor="newTreeName" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              New Tree Name
            </label>
            <input
              ref={inputRef}
              id="newTreeName"
              type="text"
              value={treeName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Miller Family Branch"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all shadow-inner"
              required
            />
          </div>

          {/* Selected Members Chips */}
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Included Members ({selectedPeople.length})</span>
            </div>
            <div className="max-h-36 overflow-y-auto border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 rounded-2xl p-2.5 flex flex-wrap gap-2">
              {selectedPeople.map((person) => {
                const displayName = getPersonDisplayName(person);
                const initial = (displayName[0] || '?').toUpperCase();
                return (
                  <div
                    key={person.id}
                    className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2.5 py-1 rounded-xl shadow-xs text-xs text-slate-700 dark:text-slate-200"
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center">
                      {initial}
                    </div>
                    <span className="font-medium truncate max-w-[140px]">{displayName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Branch Extraction Mode (Move vs Copy) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Branch Action
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setBranchMode('move')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  branchMode === 'move'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <MoveRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Move to New Tree</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Extract selection into new tree and remove them from current tree, keeping the bridge person linked.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setBranchMode('copy')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  branchMode === 'copy'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Copy className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Copy to New Tree</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Keep all members in the current tree and create a linked copy in the new tree.
                </p>
              </button>
            </div>
          </div>

          {/* Bridge / Anchor Person Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="bridgePersonSelect" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Bridge Person Linking Trees
              </label>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Connects both trees
              </span>
            </div>
            {selectedPeople.length > 1 ? (
              <select
                id="bridgePersonSelect"
                value={bridgePersonId}
                onChange={(e) => setSelectedBridgePersonId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all cursor-pointer shadow-inner"
              >
                {selectedPeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getPersonDisplayName(p)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100">
                {selectedPeople[0] ? getPersonDisplayName(selectedPeople[0]) : 'Selected person'}
              </div>
            )}
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              This person stays in both trees with an interactive link badge to jump between them.
            </p>
          </div>

          {/* Options Checkboxes */}
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={linkTrees}
                onChange={(e) => setLinkTrees(e.target.checked)}
                className="w-4 h-4 rounded-md text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Create interactive link badge on cards linking both trees
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={switchImmediately}
                onChange={(e) => setSwitchImmediately(e.target.checked)}
                className="w-4 h-4 rounded-md text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Switch to this new tree immediately
              </span>
            </label>
          </div>
        </form>


        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-850/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
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
