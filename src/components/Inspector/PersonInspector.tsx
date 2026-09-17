import React from 'react';
import type { TreeData, Person, Gender, TreeLink } from '../../types/tree';
import { getPersonDisplayName, getPersonFullName } from '../../services/treeOperations';
import {
  X,
  Trash2,
  Plus,
  ExternalLink,
  Calendar,
  MapPin,
  Heart,
  Baby,
  Users,
  Unlink,
  ArrowUp,
  Sparkles,
  Target,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  GitFork,
} from 'lucide-react';
import type { RelationshipResult } from '../../services/relationshipFinder';
import { extractYear } from '../../services/temporalEngine';
import { calculateAge } from '../../services/dateUtils';
import { DatePartsInput } from '../Common/DatePartsInput';

interface PersonInspectorProps {
  tree: TreeData;
  selectedPersonId: string | null;
  comparisonPersonId?: string | null;
  relationship?: RelationshipResult | null;
  isFocused?: boolean;
  onToggleFocus?: (personId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (personId: string) => void;
  onClearComparison?: () => void;
  onClose: () => void;
  onUpdatePerson: (personId: string, updates: Partial<Person>) => void;
  onDeletePerson: (personId: string) => void;
  onSelectPerson: (personId: string) => void;
  onAddChild: (personId: string) => void;
  onAddPartner: (personId: string) => void;
  onAddSibling: (personId: string) => void;
  onAddParent: (personId: string) => void;
  onUnlinkPartner?: (personId: string, unionId: string) => void;
  onUnlinkChild?: (childPersonId: string) => void;
  onUnlinkParentFromChild?: (childPersonId: string, parentPersonId: string) => void;
  onEditUnion?: (unionId: string) => void;
  onJumpToYear?: (year: number, moment?: any) => void;
  isReadOnly?: boolean;
  onOpenTreeLink?: (person: Person, link: TreeLink) => void;
  onLinkExistingTree?: (person: Person) => void;
  onRemoveTreeLink?: (personId: string, targetTreeId: string) => void;
}

export const PersonInspector: React.FC<PersonInspectorProps> = ({
  tree,
  selectedPersonId,
  comparisonPersonId,
  relationship,
  isFocused = false,
  onToggleFocus,
  isCollapsed = false,
  onToggleCollapse,
  onClearComparison,
  onClose,
  onUpdatePerson,
  onDeletePerson,
  onSelectPerson,
  onAddChild,
  onAddPartner,
  onAddSibling,
  onAddParent,
  onUnlinkPartner,
  onUnlinkChild,
  onUnlinkParentFromChild,
  onEditUnion,
  onJumpToYear,
  isReadOnly = false,
  onOpenTreeLink,
  onLinkExistingTree,
  onRemoveTreeLink,
}) => {
  const [isMobileMinimized, setIsMobileMinimized] = React.useState(false);

  if (!selectedPersonId) return null;

  const person = tree.people[selectedPersonId];
  if (!person) return null;

  const displayName = getPersonDisplayName(person);
  const fullName = getPersonFullName(person);

  // Find parents
  const parentUnion = person.parentUnionId ? tree.unions[person.parentUnionId] : null;
  const parents = parentUnion
    ? parentUnion.partnerIds.map((id) => tree.people[id]).filter(Boolean)
    : [];

  // Find siblings
  const siblings: Person[] = [];
  if (person.parentUnionId && tree.unions[person.parentUnionId]) {
    tree.unions[person.parentUnionId].childrenIds.forEach((cId) => {
      if (cId !== person.id && tree.people[cId]) {
        siblings.push(tree.people[cId]);
      }
    });
  }

  // Find spouses / partners
  const partners: { person: Person; unionId: string }[] = [];
  person.unionIds.forEach((uId) => {
    const union = tree.unions[uId];
    if (union) {
      union.partnerIds.forEach((pId) => {
        if (pId !== person.id && tree.people[pId]) {
          partners.push({ person: tree.people[pId], unionId: uId });
        }
      });
    }
  });

  // Find children
  const children: Person[] = [];
  person.unionIds.forEach((uId) => {
    const union = tree.unions[uId];
    if (union) {
      union.childrenIds.forEach((cId) => {
        if (tree.people[cId] && !children.some((c) => c.id === cId)) {
          children.push(tree.people[cId]);
        }
      });
    }
  });

  return (
    <div
      role="region"
      aria-label="Person Inspector"
      data-testid="person-inspector"
      className={`fixed inset-x-0 bottom-0 ${
        isMobileMinimized ? 'max-h-24' : 'max-h-[85dvh]'
      } w-full bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 z-50 flex flex-col transition-all duration-300 sm:top-0 sm:right-0 sm:bottom-auto sm:left-auto sm:w-96 sm:h-full sm:max-h-full sm:rounded-none sm:border-t-0 sm:border-l sm:border-slate-200 sm:dark:border-slate-800 pb-[env(safe-area-inset-bottom,0px)]`}
    >
      {/* Mobile drag handle */}
      <div
        className="sm:hidden flex flex-col items-center pt-2.5 pb-1 cursor-pointer select-none"
        onClick={() => setIsMobileMinimized((prev) => !prev)}
        title={isMobileMinimized ? 'Expand full inspector' : 'Minimize inspector'}
      >
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full hover:bg-slate-400 dark:hover:bg-slate-600 transition-colors" />
      </div>

      {/* Mobile Minimized Peek Bar (< sm) */}
      {isMobileMinimized ? (
        <div className="sm:hidden flex items-center justify-between px-4 py-2 bg-slate-50/80 dark:bg-slate-850/80">
          <div
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
            onClick={() => setIsMobileMinimized(false)}
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {((person.knownAs?.trim() || person.firstName)?.[0] || '') + (person.lastName?.[0] || '') || '?'}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 dark:text-white text-xs truncate">{displayName}</h3>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-0.5">
                <span>Tap to view / edit details</span>
                <ChevronUp className="w-3 h-3" />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isReadOnly && (
              <button
                onClick={() => onAddChild(person.id)}
                className="p-2 bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
                title="Add Child"
              >
                <Baby className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setIsMobileMinimized(false)}
              className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
              title="Expand inspector"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                {((person.knownAs?.trim() || person.firstName)?.[0] || '') + (person.lastName?.[0] || '') || '?'}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base leading-tight truncate max-w-[170px] sm:max-w-[180px]" title={fullName}>
                  {displayName}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                  <span className="font-mono">ID: {person.id}</span>
                  {person.knownAs?.trim() && (person.firstName || person.middleNames) && (
                    <span className="truncate max-w-[100px]" title={`Full legal name: ${fullName}`}>
                      • {person.firstName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Mobile minimize button */}
              <button
                onClick={() => setIsMobileMinimized(true)}
                className="sm:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Minimize inspector"
              >
                <ChevronDown className="w-5 h-5" />
              </button>

              {!isReadOnly && (
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to remove ${displayName} from the tree?`)) {
                      onDeletePerson(person.id);
                      onClose();
                    }
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  title="Delete person"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Close inspector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

      {/* Read-Only Notice */}
      {isReadOnly && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-850 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-1.5 font-medium">
          <Eye className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span>Viewing relative in read-only mode</span>
        </div>
      )}

      {/* Focus & Branch Control Bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 text-xs">
        {onToggleFocus && (
          <button
            onClick={() => onToggleFocus(person.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg font-medium transition-all ${
              isFocused
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400'
            }`}
            title={isFocused ? 'Exit focus mode' : 'Isolate this person and their direct lineage on the canvas'}
          >
            <Target className="w-3.5 h-3.5" />
            <span>{isFocused ? 'Focused Branch' : 'Focus Branch'}</span>
          </button>
        )}

        {children.length > 0 && onToggleCollapse && (
          <button
            onClick={() => onToggleCollapse(person.id)}
            className={`flex items-center justify-center gap-1 py-1 px-2.5 rounded-lg font-medium border transition-all ${
              isCollapsed
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-500 text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400'
            }`}
            title={isCollapsed ? 'Expand descendants branch' : 'Collapse descendants branch'}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        )}
      </div>

      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
        {/* Kinship Comparison Box or Discovery Tip */}
        {relationship && comparisonPersonId && tree.people[comparisonPersonId] ? (
          <div className="bg-gradient-to-br from-indigo-50/90 to-purple-50/90 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl p-3 shadow-2xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Compared with
              </span>
              {onClearComparison && (
                <button
                  type="button"
                  onClick={onClearComparison}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-700/50 cursor-pointer"
                  title="Clear comparison"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center border border-purple-300 dark:border-purple-800">
                B
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 dark:text-white text-xs truncate">
                  {getPersonDisplayName(tree.people[comparisonPersonId])}
                </p>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold">
                  {relationship.relationshipName}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
              {relationship.headline}
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-850 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-2.5 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Tip:</strong> Ctrl+Click another person on the tree to find their relationship (Aunt, Cousin, Grandparent, etc.).
            </span>
          </div>
        )}

        {/* Name Fields */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Identity</h4>

          {/* First Name & Middle Names */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">First Name</label>
              <input
                type="text"
                value={person.firstName || ''}
                onChange={(e) => onUpdatePerson(person.id, { firstName: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Middle Names</label>
              <input
                type="text"
                value={person.middleNames || ''}
                onChange={(e) => onUpdatePerson(person.id, { middleNames: e.target.value })}
                placeholder="e.g. Alexander"
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Last Name & Maiden / Birth Name */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Last Name</label>
              <input
                type="text"
                value={person.lastName || ''}
                onChange={(e) => onUpdatePerson(person.id, { lastName: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Maiden / Birth Name
              </label>
              <input
                type="text"
                value={person.maidenName || ''}
                onChange={(e) => onUpdatePerson(person.id, { maidenName: e.target.value })}
                placeholder="e.g. Miller (optional)"
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Known As */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Known As</label>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">
                Used on Tree
              </span>
            </div>
            <input
              type="text"
              value={person.knownAs || ''}
              onChange={(e) => onUpdatePerson(person.id, { knownAs: e.target.value })}
              placeholder="e.g. Bob (displayed on tree instead of first name)"
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              When specified, this name is displayed with the surname on the family tree instead of the first name.
            </p>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Gender</label>
            <div className="grid grid-cols-4 gap-1">
              {(['male', 'female', 'other', 'unspecified'] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onUpdatePerson(person.id, { gender: g })}
                  className={`py-1 text-xs rounded capitalize border transition-all ${
                    (person.gender || 'unspecified') === g
                      ? 'bg-indigo-600 text-white border-indigo-600 font-medium shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Avatar URL */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Photo URL</label>
            <input
              type="url"
              value={person.avatarUrl || ''}
              onChange={(e) => onUpdatePerson(person.id, { avatarUrl: e.target.value })}
              placeholder="https://... (optional)"
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Life & Dates */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Life & Dates</h4>
              {(() => {
                if (person.birthDate && person.deathDate) {
                  const ageAtDeath = calculateAge(person.birthDate, person.deathDate);
                  return ageAtDeath !== null ? (
                    <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                      Age {ageAtDeath} at death
                    </span>
                  ) : null;
                }
                if (person.birthDate && !person.isDeceased) {
                  const currentAge = calculateAge(person.birthDate);
                  return currentAge !== null ? (
                    <span className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Age {currentAge}
                    </span>
                  ) : null;
                }
                return null;
              })()}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={person.isDeceased || false}
                onChange={(e) => onUpdatePerson(person.id, { isDeceased: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              Deceased
            </label>
          </div>

          {/* Birth */}
          <div className="space-y-2 bg-slate-50/50 dark:bg-slate-850/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <DatePartsInput
              label="Birth Date"
              icon={<Calendar className="w-3 h-3 text-slate-400" />}
              value={person.birthDate}
              onChange={(val) => onUpdatePerson(person.id, { birthDate: val })}
              disabled={isReadOnly}
              yearPlaceholder="Birth Year (YYYY)"
            />
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" /> Birth Place
              </label>
              <input
                type="text"
                value={person.birthPlace || ''}
                onChange={(e) => onUpdatePerson(person.id, { birthPlace: e.target.value })}
                placeholder="City, Country"
                disabled={isReadOnly}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800/50"
              />
            </div>
          </div>

          {/* Death (if deceased) */}
          {person.isDeceased && (
            <div className="space-y-2 bg-slate-50/50 dark:bg-slate-850/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
              <DatePartsInput
                label="Death Date"
                icon={<Calendar className="w-3 h-3 text-slate-400" />}
                value={person.deathDate}
                onChange={(val) => onUpdatePerson(person.id, { deathDate: val })}
                disabled={isReadOnly}
                yearPlaceholder="Death Year (YYYY)"
              />
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" /> Death Place
                </label>
                <input
                  type="text"
                  value={person.deathPlace || ''}
                  onChange={(e) => onUpdatePerson(person.id, { deathPlace: e.target.value })}
                  placeholder="City, Country"
                  disabled={isReadOnly}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800/50"
                />
              </div>
            </div>
          )}

          {/* 4D Life Milestones & "Who Was in the Room?" */}
          {(() => {
            const bYear = extractYear(person.birthDate);
            const dYear = extractYear(person.deathDate);
            if (!bYear && !dYear) return null;

            const currentYear = new Date().getFullYear();
            const milestones: { label: string; year: number; type: 'birth' | 'birthday' | 'wedding' | 'memorial' }[] = [];

            if (bYear) {
              milestones.push({ label: `Birth (${bYear})`, year: bYear, type: 'birth' });
              [18, 50, 80].forEach((age) => {
                const y = bYear + age;
                if (y <= currentYear && (!dYear || y <= dYear)) {
                  milestones.push({ label: `${age}th Birthday (${y})`, year: y, type: 'birthday' });
                }
              });
            }

            person.unionIds.forEach((uId) => {
              const u = tree.unions[uId];
              if (u) {
                const mYear = extractYear(u.marriageDate);
                if (mYear) {
                  milestones.push({ label: `Wedding (${mYear})`, year: mYear, type: 'wedding' });
                }
              }
            });

            if (dYear) {
              milestones.push({ label: `Memorial (${dYear})`, year: dYear, type: 'memorial' });
            }

            if (milestones.length === 0) return null;

            return (
              <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-xl p-3 space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Life Milestones ("Who Was in the Room?")
                  </span>
                </div>
                <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 leading-tight">
                  Click any milestone to illuminate who was alive in the world to attend:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {milestones.map((m, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onJumpToYear?.(m.year, {
                          id: `inspector_moment_${person.id}_${m.year}`,
                          year: m.year,
                          title: `${displayName}'s ${m.label}`,
                          type: m.type,
                          personId: person.id,
                        });
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700 px-2 py-1 rounded-lg shadow-2xs transition-all hover:scale-102 cursor-pointer"
                      title={`Jump to ${m.year} and see living relatives`}
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        <hr className="border-slate-100 dark:border-slate-800" />

        {/* Family Relationships */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Family Links</h4>

          {/* Parents */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <ArrowUp className="w-3 h-3 text-blue-500" /> Parents
              </span>
              <button
                onClick={() => onAddParent(person.id)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add / Link
              </button>
            </div>
            {parents.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No parents attached</p>
            ) : (
              <div className="space-y-1">
                {parents.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg group transition-colors"
                  >
                    <div
                      onClick={() => onSelectPerson(p.id)}
                      className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
                    >
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {getPersonDisplayName(p)}
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex-shrink-0" />
                    </div>

                    {(onUnlinkParentFromChild || onUnlinkChild) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Unlink ${displayName} from parent ${getPersonDisplayName(p)}?`)) {
                            if (onUnlinkParentFromChild) {
                              onUnlinkParentFromChild(person.id, p.id);
                            } else if (onUnlinkChild) {
                              onUnlinkChild(person.id);
                            }
                          }
                        }}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-all cursor-pointer"
                        title="Unlink from this parent"
                      >
                        <Unlink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Siblings */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <Users className="w-3 h-3 text-amber-500" /> Siblings
              </span>
              <button
                onClick={() => onAddSibling(person.id)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add / Link
              </button>
            </div>
            {siblings.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No siblings attached</p>
            ) : (
              <div className="space-y-1">
                {siblings.map((sib) => (
                  <div
                    key={sib.id}
                    onClick={() => onSelectPerson(sib.id)}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer group transition-colors"
                  >
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {getPersonDisplayName(sib)}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spouses / Partners */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-500" /> Spouses / Partners
              </span>
              <button
                onClick={() => onAddPartner(person.id)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add / Link
              </button>
            </div>
            {partners.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No partners recorded</p>
            ) : (
              <div className="space-y-1">
                {partners.map(({ person: sp, unionId }) => {
                  const union = tree.unions[unionId];
                  const uType = union?.type || 'married';
                  const isDiv = uType === 'divorced';
                  const isSep = uType === 'separated';

                  return (
                    <div
                      key={`${sp.id}_${unionId}`}
                      className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-700 rounded-lg group transition-colors"
                    >
                      <div
                        onClick={() => onSelectPerson(sp.id)}
                        className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
                      >
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {getPersonDisplayName(sp)}
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-rose-600 dark:group-hover:text-rose-400 flex-shrink-0" />
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Status pill: Click to edit marriage / divorce */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditUnion?.(unionId);
                          }}
                          className={`px-1.5 py-0.5 text-[10px] font-semibold rounded capitalize transition-colors cursor-pointer ${
                            isDiv
                              ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900'
                              : isSep
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-650'
                          }`}
                          title="Click to edit marriage / divorce details"
                        >
                          {uType}
                        </button>

                        {onUnlinkPartner && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                window.confirm(
                                  `Unlink partnership between ${displayName} and ${getPersonDisplayName(sp)}?\n\nTip: If they are divorced or separated, click the status button "${uType}" instead to change relationship status without unlinking.`
                                )
                              ) {
                                onUnlinkPartner(person.id, unionId);
                              }
                            }}
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-all cursor-pointer"
                            title="Unlink this spouse/partner"
                          >
                            <Unlink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Children */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <Baby className="w-3 h-3 text-indigo-500" /> Children
              </span>
              <button
                onClick={() => onAddChild(person.id)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add / Link
              </button>
            </div>
            {children.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No children recorded</p>
            ) : (
              <div className="space-y-1">
                {children.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 border border-slate-200 dark:border-slate-700 rounded-lg group transition-colors"
                  >
                    <div
                      onClick={() => onSelectPerson(ch.id)}
                      className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
                    >
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {getPersonDisplayName(ch)}
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex-shrink-0" />
                    </div>

                    {onUnlinkChild && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Unlink child ${getPersonDisplayName(ch)} from parent?`)) {
                            onUnlinkChild(ch.id);
                          }
                        }}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-all cursor-pointer"
                        title="Unlink this child"
                      >
                        <Unlink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linked Trees */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <GitFork className="w-3 h-3 text-indigo-600 dark:text-indigo-400 rotate-90" /> Linked Trees
              </span>
              {onLinkExistingTree && (
                <button
                  type="button"
                  onClick={() => onLinkExistingTree(person)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Link Tree
                </button>
              )}
            </div>
            {(!person.linkedTrees || person.linkedTrees.length === 0) ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No external tree linked to this person</p>
            ) : (
              <div className="space-y-1.5">
                {person.linkedTrees.map((link) => (
                  <div
                    key={link.treeId}
                    className="flex items-center justify-between px-2.5 py-2 bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800/60 rounded-lg group transition-colors"
                  >
                    <div
                      onClick={() => onOpenTreeLink?.(person, link)}
                      className="flex-1 min-w-0 cursor-pointer pr-2"
                      title={`Click to jump to ${link.treeName}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 truncate">
                          {link.treeName}
                        </span>
                        <ExternalLink className="w-3 h-3 text-indigo-500 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 flex-shrink-0" />
                      </div>
                      {link.personName && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          Matches: {link.personName}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenTreeLink?.(person, link)}
                        className="px-2 py-1 text-[10px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors cursor-pointer shadow-2xs"
                        title="Open this tree"
                      >
                        Open
                      </button>
                      {onRemoveTreeLink && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Remove link to "${link.treeName}"?`)) {
                              onRemoveTreeLink(person.id, link.treeId);
                            }
                          }}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-all cursor-pointer"
                          title="Unlink this tree"
                        >
                          <Unlink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <hr className="border-slate-100 dark:border-slate-800" />

        {/* Notes / Bio */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Notes & Biography</label>
          <textarea
            rows={3}
            value={person.notes || ''}
            onChange={(e) => onUpdatePerson(person.id, { notes: e.target.value })}
            placeholder="Add personal anecdotes, historical context, or edge case notes..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        </div>
      </div>
      </>
      )}
    </div>
  );
};
