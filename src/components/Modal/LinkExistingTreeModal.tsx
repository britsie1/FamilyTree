import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { TreeData, Person, CloudTreeSummary } from '../../types/tree';
import { getPersonDisplayName, getPersonFullName } from '../../services/treeOperations';
import { listStoredTrees, loadTreeById } from '../../services/storage';
import { useAuth } from '../../contexts/AuthContext';
import { listUserCloudTrees, listSharedWithMeTrees, getCloudTree } from '../../services/firestoreService';
import {
  X,
  GitFork,
  Search,
  Check,
  Users,
  ArrowRight,
  UserCheck,
  Sparkles,
  FolderTree,
  Cloud,
  HardDrive,
  Loader2,
} from 'lucide-react';

export interface TreeOption {
  id: string;
  name: string;
  peopleCount: number;
  isCloud: boolean;
}

interface LinkExistingTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTree: TreeData;
  currentPerson: Person;
  onLinkTrees: (
    targetTreeId: string,
    targetPersonId: string,
    isTargetCloud?: boolean,
    targetTreeData?: TreeData
  ) => void;
}

export const LinkExistingTreeModal: React.FC<LinkExistingTreeModalProps> = ({
  isOpen,
  onClose,
  currentTree,
  currentPerson,
  onLinkTrees,
}) => {
  const { user, isConfigured } = useAuth();

  const [treeSearch, setTreeSearch] = useState('');
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [selectedTreeIsCloud, setSelectedTreeIsCloud] = useState<boolean>(false);
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const [cloudTrees, setCloudTrees] = useState<CloudTreeSummary[]>([]);
  const [targetTreeData, setTargetTreeData] = useState<TreeData | null>(null);
  const [loadingTargetTree, setLoadingTargetTree] = useState<boolean>(false);

  // Fetch user cloud trees if logged in
  const loadCloudTrees = useCallback(async () => {
    if (!user) return;
    try {
      const [myTrees, shared] = await Promise.all([
        listUserCloudTrees(user),
        listSharedWithMeTrees(user),
      ]);
      setCloudTrees([...myTrees, ...shared]);
    } catch (err) {
      console.warn('Could not fetch cloud trees for linking modal:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen) return;
    if (user && isConfigured) {
      loadCloudTrees();
    }
  }, [isOpen, user, isConfigured, loadCloudTrees]);

  // Combine local and cloud trees
  const availableTrees = useMemo<TreeOption[]>(() => {
    const local = listStoredTrees().filter((t) => t.id !== currentTree.id);
    const seen = new Set<string>();
    const result: TreeOption[] = [];

    // Cloud trees first
    for (const ct of cloudTrees) {
      if (ct.id === currentTree.id) continue;
      seen.add(ct.id);
      result.push({
        id: ct.id,
        name: ct.name,
        peopleCount: ct.peopleCount,
        isCloud: true,
      });
    }

    // Local trees
    for (const lt of local) {
      if (lt.id === currentTree.id) continue;
      if (!seen.has(lt.id)) {
        seen.add(lt.id);
        result.push({
          id: lt.id,
          name: lt.name,
          peopleCount: lt.peopleCount,
          isCloud: false,
        });
      }
    }

    return result;
  }, [currentTree.id, cloudTrees]);

  const filteredTrees = useMemo(() => {
    if (!treeSearch.trim()) return availableTrees;
    const q = treeSearch.toLowerCase();
    return availableTrees.filter((t) => t.name.toLowerCase().includes(q));
  }, [availableTrees, treeSearch]);

  // Load target tree data when a tree is selected
  useEffect(() => {
    if (!selectedTreeId) {
      setTargetTreeData(null);
      return;
    }

    let isMounted = true;
    if (selectedTreeIsCloud) {
      setLoadingTargetTree(true);
      getCloudTree(selectedTreeId)
        .then((t) => {
          if (!isMounted) return;
          if (t) {
            setTargetTreeData(t);
          } else {
            const localFallback = loadTreeById(selectedTreeId);
            setTargetTreeData(localFallback);
          }
        })
        .catch(() => {
          if (!isMounted) return;
          const localFallback = loadTreeById(selectedTreeId);
          setTargetTreeData(localFallback);
        })
        .finally(() => {
          if (isMounted) setLoadingTargetTree(false);
        });
    } else {
      const local = loadTreeById(selectedTreeId);
      setTargetTreeData(local);
      setLoadingTargetTree(false);
    }

    return () => {
      isMounted = false;
    };
  }, [selectedTreeId, selectedTreeIsCloud]);

  // Candidate people in target tree
  const candidatePeople = useMemo(() => {
    if (!targetTreeData) return [];
    return Object.values(targetTreeData.people);
  }, [targetTreeData]);

  // Auto-detect matching person when target tree changes
  useEffect(() => {
    if (!targetTreeData || !currentPerson) {
      setSelectedPersonId(null);
      return;
    }

    const currentFirst = (currentPerson.firstName || '').trim().toLowerCase();
    const currentLast = (currentPerson.lastName || '').trim().toLowerCase();
    const currentKnown = (currentPerson.knownAs || '').trim().toLowerCase();

    // Look for exact first + last match
    const exactMatch = Object.values(targetTreeData.people).find((p) => {
      const pFirst = (p.firstName || '').trim().toLowerCase();
      const pLast = (p.lastName || '').trim().toLowerCase();
      const pKnown = (p.knownAs || '').trim().toLowerCase();

      const nameMatch =
        pLast &&
        currentLast &&
        pLast === currentLast &&
        ((pFirst && currentFirst && pFirst === currentFirst) ||
          (pKnown && currentKnown && pKnown === currentKnown) ||
          (pKnown && currentFirst && pKnown === currentFirst) ||
          (pFirst && currentKnown && pFirst === currentKnown));

      return nameMatch;
    });

    if (exactMatch) {
      setSelectedPersonId(exactMatch.id);
    } else {
      setSelectedPersonId(targetTreeData.rootPersonId || Object.keys(targetTreeData.people)[0] || null);
    }
  }, [targetTreeData, currentPerson]);

  const filteredPeople = useMemo(() => {
    if (!candidatePeople.length) return [];
    if (!personSearch.trim()) return candidatePeople;
    const q = personSearch.toLowerCase();
    return candidatePeople.filter((p) => {
      const display = getPersonDisplayName(p).toLowerCase();
      const full = getPersonFullName(p).toLowerCase();
      return display.includes(q) || full.includes(q);
    });
  }, [candidatePeople, personSearch]);

  if (!isOpen) return null;

  const currentDisplayName = getPersonDisplayName(currentPerson);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTreeId || !selectedPersonId) return;
    onLinkTrees(
      selectedTreeId,
      selectedPersonId,
      selectedTreeIsCloud,
      targetTreeData || undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
              <GitFork className="w-5 h-5 rotate-90" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Link to Existing Tree</h2>
              <p className="text-xs text-slate-500">
                Connect <span className="font-semibold text-slate-700">{currentDisplayName}</span> to another family tree
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Informational Callout */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3.5 text-xs text-indigo-900 flex items-start gap-3">
            <FolderTree className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Cross-Tree Relationship Link: </span>
              Linking trees creates an interactive navigation badge on both people. You can jump directly between trees while keeping each tree lightweight and focused.
            </div>
          </div>

          {/* Step 1: Select Tree */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Select Target Family Tree
              </label>
              <span className="text-xs text-slate-400 font-medium">
                {availableTrees.length} {availableTrees.length === 1 ? 'tree' : 'trees'} available
              </span>
            </div>

            {/* Tree search */}
            {availableTrees.length > 3 && (
              <div className="relative mb-2.5">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                  placeholder="Search family trees..."
                  className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {availableTrees.length === 0 ? (
              <div className="p-6 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 bg-slate-50/50">
                No other family trees found in your storage or cloud account. Create a new tree first or duplicate an existing one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {filteredTrees.map((t) => {
                  const isSelected = selectedTreeId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTreeId(t.id);
                        setSelectedTreeIsCloud(t.isCloud);
                        setSelectedPersonId(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-start justify-between cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {t.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span>{t.peopleCount} {t.peopleCount === 1 ? 'person' : 'people'}</span>
                          </div>
                          {t.isCloud ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100/80 px-1.5 py-0.2 rounded-md">
                              <Cloud className="w-2.5 h-2.5 text-blue-500" /> Cloud
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200/60 px-1.5 py-0.2 rounded-md">
                              <HardDrive className="w-2.5 h-2.5 text-slate-400" /> Local
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Select Matching Person */}
          {selectedTreeId && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Select Matching Person in "{targetTreeData?.name || 'Target Tree'}"
                </label>
                {targetTreeData && (
                  <span className="text-xs text-slate-400 font-medium">
                    {candidatePeople.length} people
                  </span>
                )}
              </div>

              {loadingTargetTree ? (
                <div className="p-8 border border-slate-200 rounded-2xl flex items-center justify-center gap-2.5 text-xs text-slate-500 bg-slate-50/50">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Loading tree members from cloud...</span>
                </div>
              ) : targetTreeData ? (
                <>
                  {/* Person Search */}
                  {candidatePeople.length > 4 && (
                    <div className="relative mb-2.5">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={personSearch}
                        onChange={(e) => setPersonSearch(e.target.value)}
                        placeholder="Search people in target tree..."
                        className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {filteredPeople.map((p) => {
                  const isSelected = selectedPersonId === p.id;
                  const pName = getPersonDisplayName(p);
                  const isNameMatch =
                    pName.trim().toLowerCase() === currentDisplayName.trim().toLowerCase();

                  const birthYear = p.birthDate ? p.birthDate.split('-')[0] : '';
                  const deathYear = p.deathDate ? p.deathDate.split('-')[0] : '';
                  let lifeSpan = '';
                  if (birthYear && deathYear) lifeSpan = `${birthYear} – ${deathYear}`;
                  else if (birthYear) lifeSpan = `b. ${birthYear}`;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPersonId(p.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {pName}
                          </span>
                          {isNameMatch && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full flex-shrink-0">
                              <Sparkles className="w-2.5 h-2.5" /> Match
                            </span>
                          )}
                        </div>
                        {lifeSpan && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {lifeSpan}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
                </>
              ) : (
                <div className="p-6 border border-dashed border-rose-200 rounded-2xl text-center text-xs text-rose-500 bg-rose-50/30">
                  Could not load data for the selected tree.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 truncate max-w-[280px]">
            {selectedTreeId && selectedPersonId && targetTreeData ? (
              <span className="text-indigo-700 font-medium">
                Links {currentDisplayName} ↔ {getPersonDisplayName(targetTreeData.people[selectedPersonId])}
              </span>
            ) : (
              'Select a tree and matching person to continue'
            )}
          </div>
          <div className="flex items-center gap-3">
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
              disabled={!selectedTreeId || !selectedPersonId || loadingTargetTree}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Link Trees</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-70" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
