import React, { useState, useEffect, useCallback } from 'react';
import type { TreeData, CloudTreeSummary } from '../../types/tree';
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
import { useAuth } from '../../hooks/useAuth';
import {
  listUserCloudTrees,
  listSharedWithMeTrees,
  saveTreeToCloud,
  getCloudTree,
  deleteCloudTree,
} from '../../services/firestoreService';
import {
  X,
  Plus,
  Copy,
  Trash2,
  CheckCircle2,
  FolderOpen,
  Calendar,
  Edit2,
  Check,
  Cloud,
  HardDrive,
  Share2,
  Upload,
  Loader2,
  Eye,
} from 'lucide-react';

interface TreeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTreeId: string;
  onSwitchTree: (tree: TreeData, isCloud?: boolean) => void;
  onOpenShareModal?: () => void;
}

export const TreeManagerModal: React.FC<TreeManagerModalProps> = ({
  isOpen,
  onClose,
  currentTreeId,
  onSwitchTree,
  onOpenShareModal,
}) => {
  const { user, isConfigured, signInWithGoogle } = useAuth();

  const [activeTab, setActiveTab] = useState<'local' | 'cloud' | 'shared'>('local');
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [localTrees, setLocalTrees] = useState<TreeSummary[]>(() => listStoredTrees());
  const [cloudTrees, setCloudTrees] = useState<CloudTreeSummary[]>([]);
  const [sharedTrees, setSharedTrees] = useState<CloudTreeSummary[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setLocalTrees(listStoredTrees());
    }
  }

  const refreshLocalList = useCallback(() => {
    setLocalTrees(listStoredTrees());
  }, []);

  const loadCloudTrees = useCallback(async () => {
    if (!user) return;
    setLoadingCloud(true);
    setStatusMessage(null);
    try {
      const [myTrees, shared] = await Promise.all([
        listUserCloudTrees(user),
        listSharedWithMeTrees(user),
      ]);
      setCloudTrees(myTrees);
      setSharedTrees(shared);
    } catch (err: any) {
      console.error('Failed to load cloud trees:', err);
      setStatusMessage('Failed to fetch cloud trees: ' + err.message);
    } finally {
      setLoadingCloud(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen || !user || !isConfigured) return;
    (async () => {
      await loadCloudTrees();
    })();
  }, [isOpen, user, isConfigured, loadCloudTrees]);

  if (!isOpen) return null;

  const handleSelectLocalTree = (treeId: string) => {
    const loaded = loadTreeById(treeId);
    if (loaded) {
      onSwitchTree(loaded, false);
      onClose();
    }
  };

  const handleSelectCloudTree = async (treeId: string) => {
    setLoadingCloud(true);
    try {
      const loaded = await getCloudTree(treeId);
      if (loaded) {
        onSwitchTree(loaded, true);
        onClose();
      } else {
        setStatusMessage('Cloud tree not found or access denied.');
      }
    } catch (err: any) {
      setStatusMessage('Error opening cloud tree: ' + err.message);
    } finally {
      setLoadingCloud(false);
    }
  };

  const handleCreateNewLocal = () => {
    const newTree = createAndSaveNewTree('My New Family Tree');
    refreshLocalList();
    onSwitchTree(newTree, false);
    onClose();
  };

  const handleUploadToCloud = async (e: React.MouseEvent, summary: TreeSummary) => {
    e.stopPropagation();
    if (!isConfigured) {
      setStatusMessage('Cloud saving is not configured yet for this deployment.');
      return;
    }
    if (!user) {
      try {
        await signInWithGoogle();
      } catch (err: any) {
        setStatusMessage(err.message || 'Please sign in with Google to save to cloud.');
      }
      return;
    }

    const treeToUpload = loadTreeById(summary.id);
    if (!treeToUpload) return;

    setUploadingId(summary.id);
    try {
      await saveTreeToCloud(treeToUpload, user);
      await loadCloudTrees();
      setStatusMessage(`"${summary.name}" was successfully saved to your cloud!`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage('Failed to save to cloud: ' + err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const handleDuplicate = (e: React.MouseEvent, treeId: string) => {
    e.stopPropagation();
    const copy = duplicateTree(treeId);
    if (copy) {
      refreshLocalList();
    }
  };

  const handleDeleteLocal = (e: React.MouseEvent, treeId: string, treeName: string) => {
    e.stopPropagation();
    if (localTrees.length <= 1) {
      alert('You must have at least one tree in your workspace.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${treeName}" from local storage?`)) {
      const res = deleteStoredTree(treeId);
      refreshLocalList();
      if (treeId === currentTreeId) {
        onSwitchTree(res.newActiveTree, false);
      }
    }
  };

  const handleDeleteCloud = async (e: React.MouseEvent, treeId: string, treeName: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${treeName}" from Firebase Cloud? This cannot be undone.`)) {
      try {
        await deleteCloudTree(treeId);
        await loadCloudTrees();
      } catch (err: any) {
        setStatusMessage('Failed to delete cloud tree: ' + err.message);
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
        refreshLocalList();
        if (treeId === currentTreeId) {
          onSwitchTree(target, false);
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

    preset.id = `tree_${presetKey}_${Date.now().toString(36)}`;
    saveCurrentTree(preset);
    refreshLocalList();
    onSwitchTree(preset, false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Manage Family Trees</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Switch between saved trees or sync them to the cloud.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/40 px-5 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'local'
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Local Trees</span>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.2 rounded-full font-bold">
              {localTrees.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('cloud');
              if (user && isConfigured) loadCloudTrees();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'cloud'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>My Cloud Trees</span>
            {user && cloudTrees.length > 0 && (
              <span className="text-[10px] bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded-full font-bold">
                {cloudTrees.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('shared');
              if (user && isConfigured) loadCloudTrees();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'shared'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Shared with Me</span>
            {user && sharedTrees.length > 0 && (
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded-full font-bold">
                {sharedTrees.length}
              </span>
            )}
          </button>
        </div>

        {statusMessage && (
          <div className="mx-5 mt-3 p-2.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs rounded-xl flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Tree List Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {/* TAB 1: LOCAL TREES */}
          {activeTab === 'local' && (
            <>
              {localTrees.map((t) => {
                const isActive = t.id === currentTreeId;
                const isEditing = editingId === t.id;
                const isUploading = uploadingId === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={() => !isEditing && handleSelectLocalTree(t.id)}
                    className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800 shadow-xs'
                        : 'bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isActive ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <HardDrive className="w-4 h-4" />
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
                              className="text-sm font-semibold px-2 py-0.5 border border-indigo-500 rounded-md focus:outline-none w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                            <button
                              onClick={(e) => handleSaveRename(e, t.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {t.name || 'Untitled Tree'}
                            </h4>
                            {isActive && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-950/80 px-2 py-0.5 rounded-full flex-shrink-0">
                                <CheckCircle2 className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
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
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={(e) => handleUploadToCloud(e, t)}
                        disabled={isUploading}
                        title="Save copy to Firebase Cloud"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        {isUploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {!isEditing && (
                        <button
                          onClick={(e) => handleStartRename(e, t)}
                          title="Rename Tree"
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDuplicate(e, t.id)}
                        title="Duplicate Tree"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteLocal(e, t.id, t.name)}
                        title="Delete Tree"
                        disabled={localTrees.length <= 1}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          localTrees.length <= 1
                            ? 'text-slate-200 dark:text-slate-700 cursor-not-allowed'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* TAB 2: CLOUD TREES */}
          {activeTab === 'cloud' && (
            <>
              {!user ? (
                <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Cloud className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Sign in to view Cloud Trees</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto mb-4">
                    Sign in with Google to sync and access your family trees anywhere.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await signInWithGoogle();
                      } catch (err: any) {
                        setStatusMessage(err.message || 'Sign in failed');
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Sign in with Google
                  </button>
                </div>
              ) : loadingCloud ? (
                <div className="flex items-center justify-center py-8 gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span>Loading cloud trees...</span>
                </div>
              ) : cloudTrees.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    You have no cloud trees yet. Go to <strong className="text-slate-700 dark:text-slate-300">Local Trees</strong> and click the upload icon to save one to the cloud!
                  </p>
                </div>
              ) : (
                cloudTrees.map((t) => {
                  const isActive = t.id === currentTreeId;
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectCloudTree(t.id)}
                      className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 shadow-xs'
                          : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          <Cloud className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {t.name}
                            </h4>
                            {t.isPublic && (
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded-full">
                                Public
                              </span>
                            )}
                            {isActive && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/50 px-2 py-0.5 rounded-full flex-shrink-0">
                                <CheckCircle2 className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span>{t.peopleCount} people</span>
                            <span>•</span>
                            <span>{t.unionCount} unions</span>
                            <span>•</span>
                            <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-2">
                        {onOpenShareModal && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCloudTree(t.id).then(() => {
                                onOpenShareModal();
                              });
                            }}
                            title="Share Tree"
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteCloud(e, t.id, t.name)}
                          title="Delete Cloud Tree"
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB 3: SHARED WITH ME */}
          {activeTab === 'shared' && (
            <>
              {!user ? (
                <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Share2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Sign in to view Shared Trees</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto mb-4">
                    Sign in with your Google email to see family trees others have shared with you.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await signInWithGoogle();
                      } catch (err: any) {
                        setStatusMessage(err.message || 'Sign in failed');
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Sign in with Google
                  </button>
                </div>
              ) : loadingCloud ? (
                <div className="flex items-center justify-center py-8 gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <span>Loading shared trees...</span>
                </div>
              ) : sharedTrees.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No trees have been shared directly with <strong className="text-slate-700 dark:text-slate-300">{user.email}</strong> yet.
                  </p>
                </div>
              ) : (
                sharedTrees.map((t) => {
                  const isActive = t.id === currentTreeId;
                  const isEditor = t.role === 'editor';

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectCloudTree(t.id)}
                      className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 shadow-xs'
                          : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          <Share2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {t.name}
                            </h4>
                            <span
                              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isEditor
                                  ? 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/50'
                                  : 'text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50'
                              }`}
                            >
                              {!isEditor && <Eye className="w-2.5 h-2.5" />}
                              {isEditor ? 'Editor' : 'Viewer'}
                            </span>
                            {isActive && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full flex-shrink-0">
                                <CheckCircle2 className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span>By: {t.ownerEmail}</span>
                            <span>•</span>
                            <span>{t.peopleCount} people</span>
                            <span>•</span>
                            <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Footer with New Tree & Presets */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            onClick={handleCreateNewLocal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Local Tree</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Add Sample:</span>
            <button
              onClick={() => handleLoadPreset('double_in_law')}
              className="px-2 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Double In-Law
            </button>
            <button
              onClick={() => handleLoadPreset('divorce')}
              className="px-2 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Blended
            </button>
            <button
              onClick={() => handleLoadPreset('royal')}
              className="px-2 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Royal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
