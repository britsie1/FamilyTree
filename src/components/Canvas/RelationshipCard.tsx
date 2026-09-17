import React, { useState } from 'react';
import type { TreeData, Person } from '../../types/tree';
import type { RelationshipResult } from '../../services/relationshipFinder';
import { getPersonDisplayName } from '../../services/treeOperations';
import {
  Sparkles,
  ArrowLeftRight,
  X,
  Users,
  ChevronRight,
  Info,
  GitBranch,
} from 'lucide-react';

interface RelationshipCardProps {
  tree: TreeData;
  relationship: RelationshipResult;
  onSwap: () => void;
  onClose: () => void;
  onSelectPerson: (personId: string) => void;
}

export const RelationshipCard: React.FC<RelationshipCardProps> = ({
  tree,
  relationship,
  onSwap,
  onClose,
  onSelectPerson,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const personA = tree.people[relationship.fromPersonId];
  const personB = tree.people[relationship.toPersonId];

  if (!personA || !personB) return null;

  const nameA = getPersonDisplayName(personA);
  const nameB = getPersonDisplayName(personB);

  const getInitials = (p: Person) => {
    const namePart = (p.knownAs && p.knownAs.trim()) ? p.knownAs.trim() : (p.firstName?.trim() || '');
    return ((namePart ? namePart[0] : '') + (p.lastName?.trim() ? p.lastName.trim()[0] : '')).toUpperCase() || '?';
  };

  const getCategoryBadge = (cat: RelationshipResult['category']) => {
    switch (cat) {
      case 'direct':
        return { text: 'Direct Lineage', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'sibling':
        return { text: 'Sibling', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'collateral':
        return { text: 'Aunt / Uncle / Niece / Nephew', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'cousin':
        return { text: 'Cousin', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'spouse':
        return { text: 'Spouse / Partner', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'in-law':
        return { text: 'In-Law / Marriage', bg: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'step':
        return { text: 'Step-Family', bg: 'bg-orange-50 text-orange-700 border-orange-200' };
      case 'extended':
        return { text: 'Extended Family', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      default:
        return { text: 'Family Relationship', bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  const categoryBadge = getCategoryBadge(relationship.category);

  return (
    <div
      role="region"
      aria-label="Relationship Details"
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[94vw] sm:w-[580px] md:w-[640px] max-h-[85dvh] overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-indigo-100 p-4 sm:p-5 text-slate-800 animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 shadow-2xs ${categoryBadge.bg}`}
          >
            <Sparkles size={12} />
            {categoryBadge.text}
          </span>
          {relationship.isConsanguineous && relationship.category !== 'self' && (
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              • Blood Relative
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSwap}
            title="Swap perspective (Reverse relationship)"
            className="flex items-center justify-center gap-1 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 p-2 sm:px-2 sm:py-1 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px]"
          >
            <ArrowLeftRight size={14} />
            <span className="hidden sm:inline">Swap</span>
          </button>
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            title="Toggle details & connection path"
            className={`flex items-center justify-center gap-1 text-xs font-medium p-2 sm:px-2 sm:py-1 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] ${
              showDetails ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Info size={14} />
            <span className="hidden sm:inline">Path</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close relationship view (Esc)"
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 sm:p-1 rounded-lg transition-colors cursor-pointer ml-1 min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Relationship Comparison Row */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Person A (Reference) */}
        <div
          onClick={() => onSelectPerson(personA.id)}
          className="flex flex-col items-center flex-1 max-w-[150px] sm:max-w-[170px] p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-center group"
          title={`Click to inspect ${nameA}`}
        >
          <div className="relative">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-indigo-100 border-2 border-indigo-500 text-indigo-700 font-bold flex items-center justify-center text-sm sm:text-base shadow-sm group-hover:scale-105 transition-transform overflow-hidden">
              {personA.avatarUrl ? (
                <img src={personA.avatarUrl} alt={nameA} className="w-full h-full object-cover" />
              ) : (
                getInitials(personA)
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 bg-indigo-600 text-[10px] text-white font-bold px-1.5 py-0.2 rounded-full shadow-2xs">
              A
            </span>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-slate-800 mt-1.5 truncate max-w-full group-hover:text-indigo-600">
            {nameA}
          </span>
          <span className="text-[11px] text-slate-400">Reference</span>
        </div>

        {/* Central Relationship Badge & Headline */}
        <div className="flex flex-col items-center flex-2 text-center px-1">
          <div className="flex items-center gap-1.5">
            <span className="px-3 sm:px-4 py-1 sm:py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-sm sm:text-base rounded-full shadow-md tracking-wide">
              {relationship.relationshipName}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-700 font-medium mt-1.5 leading-snug">
            <span className="font-semibold text-slate-900">{nameB}</span> is {nameA}'s{' '}
            <span className="font-bold text-indigo-700">{relationship.relationshipName}</span>
          </p>

          <p className="text-[11px] text-slate-400 mt-0.5">
            ({nameA} is {nameB}'s {relationship.inverseRelationshipName})
          </p>
        </div>

        {/* Person B (Compared) */}
        <div
          onClick={() => onSelectPerson(personB.id)}
          className="flex flex-col items-center flex-1 max-w-[150px] sm:max-w-[170px] p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-center group"
          title={`Click to inspect ${nameB}`}
        >
          <div className="relative">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-purple-100 border-2 border-purple-500 text-purple-700 font-bold flex items-center justify-center text-sm sm:text-base shadow-sm group-hover:scale-105 transition-transform overflow-hidden">
              {personB.avatarUrl ? (
                <img src={personB.avatarUrl} alt={nameB} className="w-full h-full object-cover" />
              ) : (
                getInitials(personB)
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 bg-purple-600 text-[10px] text-white font-bold px-1.5 py-0.2 rounded-full shadow-2xs">
              B
            </span>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-slate-800 mt-1.5 truncate max-w-full group-hover:text-purple-600">
            {nameB}
          </span>
          <span className="text-[11px] text-purple-600 font-medium">Target</span>
        </div>
      </div>

      {/* Common Ancestors Pill (if any) */}
      {relationship.commonAncestors.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-center gap-1.5 text-xs text-slate-600">
          <span className="font-medium text-slate-500 flex items-center gap-1">
            <Users size={12} className="text-indigo-500" />
            Common Ancestor{relationship.commonAncestors.length > 1 ? 's' : ''}:
          </span>
          {relationship.commonAncestors.map((anc) => (
            <button
              key={anc.id}
              type="button"
              onClick={() => onSelectPerson(anc.id)}
              className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 px-2 py-0.5 rounded-md font-medium text-slate-700 transition-colors cursor-pointer"
            >
              {getPersonDisplayName(anc)}
            </button>
          ))}
        </div>
      )}

      {/* Expandable Step-by-Step Path */}
      {showDetails && relationship.pathSteps.length > 1 && (
        <div className="mt-3 pt-3 border-t border-slate-100 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
            <GitBranch size={13} className="text-indigo-500" />
            Connection Path:
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs">
            {relationship.pathSteps.map((step, idx) => (
              <React.Fragment key={step.personId}>
                <button
                  type="button"
                  onClick={() => onSelectPerson(step.personId)}
                  className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    step.personId === relationship.fromPersonId
                      ? 'bg-indigo-600 text-white'
                      : step.personId === relationship.toPersonId
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-indigo-50 border border-slate-200'
                  }`}
                >
                  {step.personName}
                </button>

                {idx < relationship.pathSteps.length - 1 && (
                  <div className="flex items-center text-slate-400 gap-0.5 px-0.5">
                    {step.relationToNext && (
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-200/70 px-1 py-0.2 rounded">
                        {step.relationToNext}
                      </span>
                    )}
                    <ChevronRight size={13} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {relationship.description && (
            <p className="text-xs text-slate-500 mt-2 italic text-center">
              {relationship.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
