import React, { useState, useEffect, useCallback } from 'react';
import type { TreeData } from '../../types/tree';
import {
  listSnapshots,
  getSnapshot,
  deleteSnapshot,
  createSnapshot,
  restoreSnapshot,
  type SnapshotSummary,
  type SnapshotReason,
} from '../../services/snapshotService';
import { sanitizeFilename } from '../../services/storage';
import { useNotificationStore } from '../../stores/useNotificationStore';
import confetti from 'canvas-confetti';
import {
  History,
  X,
  RotateCcw,
  Download,
  Trash2,
  Clock,
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Users,
  GitCommit,
} from 'lucide-react';

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 14) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTree: TreeData;
  onRestoreTree: (restoredTree: TreeData) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  currentTree,
  onRestoreTree,
}) => {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualDescription, setManualDescription] = useState('');
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [confirmRestoreSnap, setConfirmRestoreSnap] = useState<SnapshotSummary | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const addNotification = useNotificationStore((s) => s.addNotification);

  const currentTreeId = currentTree?.id;

  const loadList = useCallback(async () => {
    if (!currentTreeId) return;
    setLoading(true);
    setActionError(null);
    try {
      const list = await listSnapshots(currentTreeId);
      setSnapshots(list);
    } catch (err: any) {
      console.error('Failed to load snapshots:', err);
      setActionError('Could not load version history: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [currentTreeId]);

  useEffect(() => {
    let ignore = false;
    if (isOpen && currentTreeId) {
      listSnapshots(currentTreeId)
        .then((list) => {
          if (!ignore) {
            setSnapshots(list);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!ignore) {
            setActionError('Could not load version history: ' + (err.message || 'Unknown error'));
            setLoading(false);
          }
        });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, currentTreeId]);

  if (!isOpen) return null;

  const currentPersonCount = Object.keys(currentTree.people || {}).length;
  const currentUnionCount = Object.keys(currentTree.unions || {}).length;

  const handleCreateManualSnapshot = async () => {
    setIsCreatingManual(true);
    setActionError(null);
    try {
      const desc = manualDescription.trim() || 'Manual user checkpoint';
      await createSnapshot(currentTree, 'manual', desc);
      setManualDescription('');
      await loadList();
      addNotification({
        type: 'success',
        title: 'Snapshot Created',
        message: `Saved manual checkpoint: "${desc}"`,
      });
    } catch (err: any) {
      setActionError('Failed to create snapshot: ' + err.message);
    } finally {
      setIsCreatingManual(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!confirmRestoreSnap) return;
    setIsRestoring(true);
    setActionError(null);
    try {
      const { restoredTree } = await restoreSnapshot(
        confirmRestoreSnap.id,
        currentTree
      );

      onRestoreTree(restoredTree);
      setConfirmRestoreSnap(null);
      await loadList();

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      addNotification({
        type: 'success',
        title: 'Tree Restored Successfully',
        message: `Restored to version from ${new Date(confirmRestoreSnap.timestamp).toLocaleTimeString()}. A safety undo snapshot was saved.`,
      });
    } catch (err: any) {
      console.error('Failed to restore snapshot:', err);
      setActionError('Failed to restore snapshot: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDownloadSnapshot = async (snap: SnapshotSummary) => {
    try {
      const full = await getSnapshot(snap.id);
      if (!full) throw new Error('Snapshot content not found.');

      const jsonStr = JSON.stringify(full.treeData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = sanitizeFilename(snap.treeName);
      a.download = `${safeName}_snapshot_${snap.timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionError('Failed to download snapshot: ' + err.message);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    try {
      await deleteSnapshot(id);
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
      addNotification({
        type: 'info',
        title: 'Snapshot Deleted',
        message: 'The selected backup was removed.',
      });
    } catch (err: any) {
      setActionError('Failed to delete snapshot: ' + err.message);
    }
  };

  const getReasonBadge = (reason: SnapshotReason) => {
    switch (reason) {
      case 'pre-json-import':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            Pre-JSON Import
          </span>
        );
      case 'pre-gedcom-import':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            Pre-GEDCOM Import
          </span>
        );
      case 'pre-cloud-merge':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Pre-Cloud Merge
          </span>
        );
      case 'pre-restore':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Safety Undo
          </span>
        );
      case 'pre-tree-clear':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            Pre-Tree Clear
          </span>
        );
      case 'pre-preset-switch':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Pre-Preset Switch
          </span>
        );
      case 'pre-delete-person':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Pre-Delete Person
          </span>
        );
      case 'manual':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
            Manual Checkpoint
          </span>
        );
      case 'periodic':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Auto-Save
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Version History & Snapshots
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentTree.name || 'Current Tree'} • {currentPersonCount} people • {currentUnionCount} relationships
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div className="px-5 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs border-b border-rose-200 dark:border-rose-900/50 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Manual Snapshot Toolbar */}
        <div className="px-5 sm:px-6 py-3 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-950/50 flex items-center gap-2">
          <input
            type="text"
            placeholder="Label a new checkpoint (e.g. 'Before reorganizing maternal branch')..."
            value={manualDescription}
            onChange={(e) => setManualDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateManualSnapshot();
            }}
            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleCreateManualSnapshot}
            disabled={isCreatingManual}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-all cursor-pointer shrink-0"
          >
            {isCreatingManual ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Save Checkpoint</span>
          </button>
        </div>

        {/* Snapshot List Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span>Loading snapshot history...</span>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium">No snapshots recorded yet</p>
              <p className="text-xs max-w-sm mx-auto">
                Snapshots are automatically captured before risky operations (GEDCOM/JSON imports, cloud merges) and periodically during active editing.
              </p>
            </div>
          ) : (
            snapshots.map((snap) => {
              const diffPeople = snap.personCount - currentPersonCount;
              const diffUnions = snap.unionCount - currentUnionCount;

              return (
                <div
                  key={snap.id}
                  className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/60 bg-white dark:bg-slate-850 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getReasonBadge(snap.reason)}
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {formatRelativeTime(snap.timestamp)}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        • {new Date(snap.timestamp).toLocaleString()}
                      </span>
                    </div>

                    {snap.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {snap.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {snap.personCount} people
                        {diffPeople !== 0 && (
                          <span
                            className={
                              diffPeople > 0
                                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                : 'text-rose-500 dark:text-rose-400 font-medium'
                            }
                          >
                            ({diffPeople > 0 ? `+${diffPeople}` : diffPeople})
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitCommit className="w-3.5 h-3.5 text-slate-400" />
                        {snap.unionCount} unions
                        {diffUnions !== 0 && (
                          <span
                            className={
                              diffUnions > 0
                                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                : 'text-rose-500 dark:text-rose-400 font-medium'
                            }
                          >
                            ({diffUnions > 0 ? `+${diffUnions}` : diffUnions})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Actions for snapshot */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => handleDownloadSnapshot(snap)}
                      className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                      title="Download JSON backup for this snapshot"
                      aria-label="Download snapshot JSON"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSnapshot(snap.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                      title="Delete this snapshot"
                      aria-label="Delete snapshot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmRestoreSnap(snap)}
                      className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs hover:shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Restore Confirmation Dialog Overlay */}
        {confirmRestoreSnap && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-20 animate-in fade-in duration-100">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 max-w-md w-full shadow-2xl space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <RotateCcw className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Restore this tree version?
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                You are about to restore the tree to the state captured at{' '}
                <strong>{new Date(confirmRestoreSnap.timestamp).toLocaleString()}</strong> (
                {confirmRestoreSnap.personCount} people, {confirmRestoreSnap.unionCount} unions).
              </p>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Safety Undo Included:</strong> An automatic snapshot of your current tree will be created right now before restoring, so you can easily revert anytime.
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setConfirmRestoreSnap(null)}
                  disabled={isRestoring}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  {isRestoring ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Restore</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between text-xs text-slate-400">
          <span>Keeps up to 20 recent snapshots + 14 daily backups</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
