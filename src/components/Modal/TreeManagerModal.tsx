import React, { useState } from 'react';
import type { TreeData } from '../../types/tree';
import {
  listStoredTrees,
  loadTreeById,
  deleteStoredTree,
  duplicateTree,
  createAndSaveNewTree,
  saveCurrentTree,
  createDoubleInLawPreset,
  createDivorceBlendedPreset,
  createThreeGenSampleTree,
  type TreeSummary,
} from '../../services/storage';
import {
  X,
  Plus,
  Copy,
  Trash2,
  CheckCircle2,
  FolderOpen,
  Calendar,
  Users,
  Edit2,
  Check,
} from 'lucide-react';

interface TreeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTreeId: string;
  onSwitchTree: (tree: TreeData) => void;
}

export const TreeManagerModal: React.FC<TreeManagerModalProps> = ({
  isOpen,
  onClose,
  currentTreeId,
  onSwitchTree,
}) => {
  const [trees, setTrees] = useState<TreeSummary[]>(() => listStoredTrees());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (!isOpen) return null;

  const refreshList = () => {
    setTrees(listStoredTrees());
  };

  const handleSelectTree = (treeId: string) => {
    const loaded = loadTreeById(treeId);
    if (loaded) {
      onSwitchTree(loaded);
      onClose();
    }
  };

  const handleCreateNew = () => {
    const newTree = createAndSaveNewTree('My New Family Tree');
    refreshList();
    onSwitchTree(newTree);
    onClose();
  };

  const handleDuplicate = (e: React.MouseEvent, treeId: string) => {
    e.stopPropagation();
    const copy = duplicateTree(treeId);
    if (copy) {
      refreshList();
    }
  };

  const handleDelete = (e: React.MouseEvent, treeId: string, treeName: string) => {
    e.stopPropagation();
    if (trees.length <= 1) {
      alert('You must have at least one tree in your workspace.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${treeName}"? This cannot be undone.`)) {
      const res = deleteStoredTree(treeId);
      refreshList();
      if (treeId === currentTreeId) {
        onSwitchTree(res.newActiveTree);
      }
    }
  };

  const handleStartRename = (e: React.MouseEvent, summary: TreeSummary) => {
    e.stopPropagation();
    setEditingId(summary.id);
    setEditName(summary.name);
  };

  const handleSaveRename = (e: React.MouseEvent, treeId: string) => {
    e.stopPropagation();
    if (editName.trim()) {
      const target = loadTreeById(treeId);
      if (target) {
        target.name = editName.trim();
        saveCurrentTree(target);
        refreshList();
        if (treeId === currentTreeId) {
          onSwitchTree(target);
        }
      }
    }
    setEditingId(null);
  };

  const handleLoadPreset = (presetKey: 'double_in_law' | 'divorce' | 'royal') => {
    let preset: TreeData;
    if (presetKey === 'double_in_law') preset = createDoubleInLawPreset();
    else if (presetKey === 'divorce') preset = createDivorceBlendedPreset();
    else preset = createThreeGenSampleTree();

    // Give a unique ID so it is added as a fresh tree
    preset.id = `tree_${presetKey}_${Date.now().toString(36)}`;
    saveCurrentTree(preset);
    refreshList();
    onSwitchTree(preset);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Manage Family Trees</h3>
              <p className="text-xs text-slate-500">
                Switch between saved trees or create new branches without losing your work.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tree List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {trees.map((t) => {
            const isActive = t.id === currentTreeId;
            const isEditing = editingId === t.id;

            return (
              <div
                key={t.id}
                onClick={() => !isEditing && handleSelectTree(t.id)}
                className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editName}
                          autoFocus
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(e as any, t.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="text-sm font-semibold px-2 py-0.5 border border-indigo-500 rounded-md focus:outline-none w-full"
                        />
                        <button
                          onClick={(e) => handleSaveRename(e, t.id)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">
                          {t.name || 'Untitled Tree'}
                        </h4>
                        {isActive && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span>{t.peopleCount} {t.peopleCount === 1 ? 'person' : 'people'}</span>
                      <span>•</span>
                      <span>{t.unionCount} {t.unionCount === 1 ? 'union' : 'unions'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(t.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 ml-2 opacity-80 group-hover:opacity-100">
                  {!isEditing && (
                    <button
                      onClick={(e) => handleStartRename(e, t)}
                      title="Rename Tree"
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDuplicate(e, t.id)}
                    title="Duplicate Tree"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, t.id, t.name)}
                    title="Delete Tree"
                    disabled={trees.length <= 1}
                    className={`p-1.5 rounded-lg transition-colors ${
                      trees.length <= 1
                        ? 'text-slate-200 cursor-not-allowed'
                        : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with New Tree & Presets */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            onClick={handleCreateNew}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Tree</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="text-[11px] font-medium text-slate-400">Add Sample:</span>
            <button
              onClick={() => handleLoadPreset('double_in_law')}
              className="px-2 py-1 text-[11px] bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 rounded-lg transition-colors"
            >
              Double In-Law
            </button>
            <button
              onClick={() => handleLoadPreset('divorce')}
              className="px-2 py-1 text-[11px] bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 rounded-lg transition-colors"
            >
              Blended
            </button>
            <button
              onClick={() => handleLoadPreset('royal')}
              className="px-2 py-1 text-[11px] bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 rounded-lg transition-colors"
            >
              Royal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
