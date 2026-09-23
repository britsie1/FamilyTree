import React, { useState, useMemo, useEffect } from 'react';
import type { TreeData } from '../../types/tree';
import { findRelationship } from '../../services/relationshipFinder';
import { getPersonDisplayName, getPersonDisplayInfo } from '../../services/displayUtils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import confetti from 'canvas-confetti';
import {
  X,
  Sparkles,
  ArrowLeftRight,
  GitCommit,
  Search,
  Crown,
} from 'lucide-react';

export interface KinshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  tree: TreeData;
  initialPersonId?: string | null;
  onSelectPerson?: (personId: string) => void;
}

export const KinshipModal: React.FC<KinshipModalProps> = ({
  isOpen,
  onClose,
  tree,
  initialPersonId,
  onSelectPerson,
}) => {
  const peopleList = useMemo(() => Object.values(tree.people), [tree.people]);
  const defaultPersonA = initialPersonId || peopleList[0]?.id || null;
  const defaultPersonB = peopleList.length > 1 ? (peopleList[1]?.id !== defaultPersonA ? peopleList[1]?.id : peopleList[2]?.id) || null : null;

  const [personAId, setPersonAId] = useState<string | null>(defaultPersonA);
  const [personBId, setPersonBId] = useState<string | null>(defaultPersonB);
  const [prevInitialPersonId, setPrevInitialPersonId] = useState<string | null | undefined>(initialPersonId);

  if (initialPersonId !== prevInitialPersonId) {
    setPrevInitialPersonId(initialPersonId);
    if (initialPersonId && tree.people[initialPersonId]) {
      setPersonAId(initialPersonId);
    }
  }

  const [queryA, setQueryA] = useState('');
  const [queryB, setQueryB] = useState('');
  const [isPickingA, setIsPickingA] = useState(false);
  const [isPickingB, setIsPickingB] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const personA = personAId ? tree.people[personAId] : null;
  const personB = personBId ? tree.people[personBId] : null;

  const relationship = useMemo(() => {
    if (!personAId || !personBId) return null;
    return findRelationship(tree, personAId, personBId);
  }, [tree, personAId, personBId]);

  if (!isOpen) return null;

  const handleSwap = () => {
    const temp = personAId;
    setPersonAId(personBId);
    setPersonBId(temp);
  };

  const handleApplyToCanvas = () => {
    if (personAId && personBId) {
      useCanvasStore.getState().selectPerson(personAId);
      useCanvasStore.getState().setComparisonPersonId(personBId);
      useCanvasStore.getState().centerOnPerson(personAId);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }
    onClose();
  };

  const filteredPeopleA = peopleList.filter((p) => {
    if (!queryA.trim()) return true;
    const q = queryA.toLowerCase();
    const name = getPersonDisplayName(p).toLowerCase();
    return name.includes(q) || p.id.toLowerCase().includes(q);
  });

  const filteredPeopleB = peopleList.filter((p) => {
    if (!queryB.trim()) return true;
    const q = queryB.toLowerCase();
    const name = getPersonDisplayName(p).toLowerCase();
    return name.includes(q) || p.id.toLowerCase().includes(q);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[88vh] max-h-[88dvh] overflow-hidden animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 flex-shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-100 dark:shadow-purple-950 flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Kinship & Relationship Calculator
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Determine the precise genealogical link and lineage path between any two relatives
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Person Selector Controls */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/40 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Person A Selector */}
            <div className="relative w-full sm:flex-1">
              <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                Reference Person (A)
              </label>
              <div
                onClick={() => setIsPickingA((prev) => !prev)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-400 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    A
                  </div>
                  <span className="text-sm font-semibold truncate text-slate-900 dark:text-white">
                    {personA ? getPersonDisplayName(personA) : 'Select person A...'}
                  </span>
                </div>
              </div>

              {isPickingA && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-850 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 p-2 max-h-56 overflow-y-auto">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search name..."
                      value={queryA}
                      onChange={(e) => setQueryA(e.target.value)}
                      className="bg-transparent text-xs w-full focus:outline-none text-slate-800 dark:text-slate-100"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-0.5">
                    {filteredPeopleA.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setPersonAId(p.id);
                          setIsPickingA(false);
                          setQueryA('');
                        }}
                        className="px-2.5 py-1.5 hover:bg-indigo-50 dark:hover:bg-slate-750 rounded-lg cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
                      >
                        {getPersonDisplayName(p)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwap}
              className="p-2 sm:mt-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-2xs cursor-pointer flex-shrink-0"
              title="Swap perspective (A ↔ B)"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>

            {/* Person B Selector */}
            <div className="relative w-full sm:flex-1">
              <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                Comparison Target (B)
              </label>
              <div
                onClick={() => setIsPickingB((prev) => !prev)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between cursor-pointer hover:border-purple-400 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    B
                  </div>
                  <span className="text-sm font-semibold truncate text-slate-900 dark:text-white">
                    {personB ? getPersonDisplayName(personB) : 'Select person B...'}
                  </span>
                </div>
              </div>

              {isPickingB && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-850 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 p-2 max-h-56 overflow-y-auto">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search name..."
                      value={queryB}
                      onChange={(e) => setQueryB(e.target.value)}
                      className="bg-transparent text-xs w-full focus:outline-none text-slate-800 dark:text-slate-100"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-0.5">
                    {filteredPeopleB.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setPersonBId(p.id);
                          setIsPickingB(false);
                          setQueryB('');
                        }}
                        className="px-2.5 py-1.5 hover:bg-purple-50 dark:hover:bg-slate-750 rounded-lg cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
                      >
                        {getPersonDisplayName(p)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Calculation Result Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
          {relationship ? (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Primary Headline Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-slate-50/50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-850 border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Relationship Result
                  </span>
                  <div className="flex items-center gap-1.5">
                    {relationship.isConsanguineous ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        Blood Relative
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        Affinity / Marriage
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {relationship.generationDifference === 0
                        ? 'Same generation'
                        : relationship.generationDifference > 0
                        ? `+${relationship.generationDifference} generation${relationship.generationDifference === 1 ? '' : 's'}`
                        : `${relationship.generationDifference} generation${relationship.generationDifference === -1 ? '' : 's'}`}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug">
                  {relationship.headline}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Inverse: <span className="font-semibold text-slate-700 dark:text-slate-300">{relationship.inverseHeadline}</span>
                </p>

                {relationship.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 pt-2.5 border-t border-indigo-100 dark:border-indigo-900/60 leading-relaxed">
                    {relationship.description}
                  </p>
                )}
              </div>

              {/* Shared Common Ancestors */}
              {relationship.commonAncestors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>Common Ancestor{relationship.commonAncestors.length === 1 ? '' : 's'}</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {relationship.commonAncestors.map((anc) => {
                      const dInfo = getPersonDisplayInfo(anc);
                      return (
                        <div
                          key={anc.id}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700"
                        >
                          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {dInfo.initials || 'A'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                              {dInfo.displayName}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                              {dInfo.standardDateText || 'Dates unspecified'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step-by-Step Connection Path */}
              {relationship.pathSteps.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <GitCommit className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Genealogical Connection Path ({relationship.pathSteps.length} relatives)</span>
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs">
                    {relationship.pathSteps.map((step, idx) => (
                      <React.Fragment key={step.personId}>
                        <div
                          onClick={() => {
                            if (onSelectPerson) onSelectPerson(step.personId);
                            useCanvasStore.getState().centerOnPerson(step.personId);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer shadow-2xs hover:scale-105 transition-all truncate max-w-[150px]"
                          title="Click to locate on canvas"
                        >
                          {step.personName}
                        </div>
                        {idx < relationship.pathSteps.length - 1 && (
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            →
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
              Select two relatives above to calculate their genealogical relationship.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-850/50 flex-shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Tip: You can also hold <kbd className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600">Ctrl</kbd> and click any card on the canvas.
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
            {relationship && (
              <button
                onClick={handleApplyToCanvas}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer hover:scale-105"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Highlight Path on Canvas</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
