import React from 'react';
import type { LayoutNode, Gender, LayoutStyle } from '../../types/tree';
import { getPersonDisplayName, getPersonFullName } from '../../services/treeOperations';
import { getPersonTemporalInfo, type HistoricalMoment } from '../../services/temporalEngine';
import { User, Heart, Baby, Users, ArrowUp, ArrowLeft, ChevronDown, ChevronUp, Sparkles, Cake, Check } from 'lucide-react';

interface PersonCardProps {
  node: LayoutNode;
  layoutStyle?: LayoutStyle;
  isSelected: boolean;
  isMultiSelected?: boolean;
  isCompared?: boolean;
  isOnRelationshipPath?: boolean;
  hasActiveComparison?: boolean;
  isHovered: boolean;
  hasDescendants?: boolean;
  temporalYear?: number | null;
  isRoomHonoree?: boolean;
  activeMoment?: HistoricalMoment | null;
  onToggleCollapse?: (personId: string) => void;
  onSelect: (personId: string, event: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent, personId: string) => void;
  onHover: (personId: string | null) => void;
  onAddChild: (personId: string) => void;
  onAddPartner: (personId: string) => void;
  onAddSibling: (personId: string) => void;
  onAddParent: (personId: string) => void;
  onDragStart: (e: React.MouseEvent, personId: string) => void;
}

export const PersonCard: React.FC<PersonCardProps> = ({
  node,
  layoutStyle = 'vertical',
  isSelected,
  isMultiSelected = false,
  isCompared = false,
  isOnRelationshipPath = false,
  hasActiveComparison = false,
  isHovered,
  hasDescendants = false,
  temporalYear = null,
  isRoomHonoree = false,
  activeMoment: _activeMoment = null,
  onToggleCollapse,
  onSelect,
  onContextMenu,
  onHover,
  onAddChild,
  onAddPartner,
  onAddSibling,
  onAddParent,
  onDragStart,
}) => {
  const { data: person, x, y, width, height } = node;

  const displayName = getPersonDisplayName(person);
  const fullName = getPersonFullName(person);
  const isUnnamed = !person.knownAs?.trim() && !person.firstName?.trim() && !person.lastName?.trim();

  // Temporal 4D calculations
  const isTemporalActive = temporalYear !== null && temporalYear !== undefined;
  const temporalInfo = isTemporalActive ? getPersonTemporalInfo(person, temporalYear) : null;
  const isUnborn = temporalInfo?.status === 'unborn';
  const isDeceasedAtYear = temporalInfo?.status === 'deceased';
  const isLivingAtYear = temporalInfo?.status === 'living';

  // Format birth - death years
  const birthYear = person.birthDate ? person.birthDate.split('-')[0] : '';
  const deathYear = person.deathDate ? person.deathDate.split('-')[0] : '';
  let dateText = '';

  if (isTemporalActive && temporalInfo) {
    if (isUnborn) {
      dateText = temporalInfo.ageLabel;
    } else if (isDeceasedAtYear) {
      dateText = temporalInfo.ageLabel;
    } else {
      dateText = `Age ${temporalInfo.age ?? '?'} (b. ${birthYear || '?'})`;
    }
  } else if (birthYear && deathYear) {
    dateText = `${birthYear} – ${deathYear}`;
  } else if (birthYear) {
    dateText = person.isDeceased ? `b. ${birthYear} (deceased)` : `b. ${birthYear}`;
  } else if (deathYear) {
    dateText = `d. ${deathYear}`;
  }

  // Gender colors & badges
  const getGenderStyles = (gender?: Gender) => {
    switch (gender) {
      case 'male':
        return {
          avatarBg: 'bg-blue-100 text-blue-600 border-blue-200',
          borderAccent: 'border-l-blue-500',
        };
      case 'female':
        return {
          avatarBg: 'bg-rose-100 text-rose-600 border-rose-200',
          borderAccent: 'border-l-rose-500',
        };
      default:
        return {
          avatarBg: 'bg-slate-100 text-slate-600 border-slate-200',
          borderAccent: 'border-l-indigo-500',
        };
    }
  };

  const styles = getGenderStyles(person.gender);

  // Initials (preferred knownAs or firstName, plus lastName)
  const namePart = (person.knownAs && person.knownAs.trim()) ? person.knownAs.trim() : (person.firstName?.trim() || '');
  const initials = (
    (namePart ? namePart[0] : '') +
    (person.lastName?.trim() ? person.lastName.trim()[0] : '')
  ).toUpperCase() || '?';

  // Compute card style classes based on 4D temporal status
  let cardStateClasses = styles.borderAccent;
  if (isUnborn) {
    cardStateClasses = 'border-slate-300 border-dashed bg-slate-50/70 opacity-20 hover:opacity-50 grayscale';
  } else if (isDeceasedAtYear) {
    cardStateClasses = 'border-slate-300 bg-slate-100/80 grayscale opacity-45 hover:opacity-75';
  } else if (isRoomHonoree) {
    cardStateClasses = 'ring-3 ring-amber-500 border-amber-500 bg-amber-50/40 shadow-xl z-35 animate-pulse';
  } else if (isTemporalActive && isLivingAtYear) {
    cardStateClasses = `${styles.borderAccent} ring-1 ring-emerald-500/70 border-emerald-400 shadow-md`;
  }

  return (
    <div
      style={{
        position: 'absolute',
        transform: `translate(${x}px, ${y}px)`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      className={`group select-none pointer-events-auto transition-all duration-150 cursor-grab active:cursor-grabbing rounded-xl bg-white border border-l-4 shadow-sm ${cardStateClasses} ${
        isSelected || isMultiSelected
          ? 'ring-2 ring-indigo-600 border-indigo-600 shadow-lg z-30'
          : isCompared
          ? 'ring-2 ring-purple-600 border-purple-600 shadow-lg z-30'
          : isOnRelationshipPath
          ? 'ring-2 ring-indigo-300 border-indigo-400 shadow-md z-25'
          : isHovered
          ? 'border-slate-400 shadow-md z-20'
          : 'border-slate-200 hover:border-slate-300 z-10'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(person.id, e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e, person.id);
      }}
      onMouseEnter={() => onHover(person.id)}
      onMouseLeave={() => onHover(null)}
      onMouseDown={(e) => onDragStart(e, person.id)}
    >
      {/* Honoree Pill Badge */}
      {isRoomHonoree && (
        <span
          title="Historical Moment Focus Honoree"
          className="absolute -top-2.5 -right-2 bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-35 flex items-center gap-1 border border-amber-300"
        >
          <Cake className="w-3 h-3" />
          <span>Honoree</span>
        </span>
      )}

      {/* Multi-selection Checkmark Indicator */}
      {isMultiSelected && !hasActiveComparison && (
        <span
          title="Selected"
          className="absolute -top-2 -left-2 bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center shadow-md z-35 animate-in zoom-in-75 duration-100"
        >
          <Check className="w-3 h-3 stroke-[3]" />
        </span>
      )}

      {/* Comparison mode badge indicators */}
      {hasActiveComparison && isSelected && (
        <span
          title="Reference Person (A)"
          className="absolute -top-2 -left-2 bg-indigo-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md z-35"
        >
          A
        </span>
      )}
      {isCompared && (
        <span
          title="Comparison Target (B)"
          className="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md z-35 animate-bounce"
        >
          B
        </span>
      )}
      {isOnRelationshipPath && !isSelected && !isCompared && (
        <span
          title="On Relationship Connection Path"
          className="absolute -top-2 right-2 bg-indigo-500/90 text-white text-[9px] font-semibold px-1.5 py-0.2 rounded-full shadow-xs z-35"
        >
          Path
        </span>
      )}

      <div className="flex items-center gap-3 p-2.5 h-full relative">
        {/* Avatar */}
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border flex-shrink-0 overflow-hidden shadow-inner ${styles.avatarBg} ${
            isUnborn ? 'opacity-40' : ''
          }`}
        >
          {person.avatarUrl ? (
            <img
              src={person.avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : initials !== '?' ? (
            <span>{initials}</span>
          ) : (
            <User className="w-5 h-5 opacity-60" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <h4
              className={`text-sm font-semibold truncate leading-tight ${
                isUnborn
                  ? 'text-slate-400 font-normal italic'
                  : isUnnamed
                  ? 'text-slate-400 italic'
                  : 'text-slate-800'
              }`}
              title={person.knownAs?.trim() && (person.firstName || person.middleNames) ? `${displayName} (${fullName})` : fullName}
            >
              {displayName}
            </h4>
            {person.isDeceased && !isTemporalActive && (
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-normal flex-shrink-0">
                ✝
              </span>
            )}
          </div>

          {person.maidenName && (
            <p className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">
              née {person.maidenName}
            </p>
          )}

          {/* Temporal Age Badge or Standard Date Text */}
          {isTemporalActive && temporalInfo ? (
            <div className="mt-0.5">
              {isLivingAtYear ? (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full shadow-xs">
                    <Sparkles className="w-2.5 h-2.5" />
                    {temporalInfo.ageLabel}
                  </span>
                  {person.notes && (
                    <span className="text-[10px] text-slate-500 truncate italic">
                      {person.notes}
                    </span>
                  )}
                </div>
              ) : isDeceasedAtYear ? (
                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                  <span className="text-slate-400">✝</span> {temporalInfo.ageLabel}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 italic">
                  {temporalInfo.ageLabel}
                </span>
              )}
            </div>
          ) : (
            dateText && (
              <p className="text-[11px] text-slate-500 truncate font-mono mt-0.5 leading-tight">
                {dateText}
              </p>
            )
          )}

          {!isTemporalActive && person.birthPlace && !dateText && (
            <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">
              {person.birthPlace}
            </p>
          )}
        </div>
      </div>

      {/* Quick Action Floating Buttons (Hover or Selected) - suppressed for unborn in temporal mode */}
      {!isUnborn && (
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-200 ${
            isSelected || isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
        {layoutStyle === 'horizontal' ? (
          <>
            {/* Left: + Parent (in horizontal layout, previous generation is to the left) */}
            <button
              className="pointer-events-auto absolute -left-3.5 top-1/2 -translate-y-1/2 bg-white border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-full w-7 h-7 flex items-center justify-center shadow-md transition-all scale-90 hover:scale-105"
              title="Add Parent"
              onClick={(e) => {
                e.stopPropagation();
                onAddParent(person.id);
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

            {/* Right: + Child (in horizontal layout, next generation is to the right) */}
            <button
              className="pointer-events-auto absolute -right-3.5 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-2.5 h-7 flex items-center justify-center gap-1 shadow-md transition-all scale-90 hover:scale-105 text-xs font-medium"
              title="Add Child"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(person.id);
              }}
            >
              <Baby className="w-3.5 h-3.5" />
              <span>Child</span>
            </button>

            {/* Top: + Partner */}
            <button
              className="pointer-events-auto absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white border border-slate-300 hover:border-rose-500 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-full w-7 h-7 flex items-center justify-center shadow-md transition-all scale-90 hover:scale-105"
              title="Add Spouse / Partner"
              onClick={(e) => {
                e.stopPropagation();
                onAddPartner(person.id);
              }}
            >
              <Heart className="w-3.5 h-3.5" />
            </button>

            {/* Bottom: + Sibling */}
            <button
              className="pointer-events-auto absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-white border border-slate-300 hover:border-amber-500 hover:bg-amber-50 text-slate-700 hover:text-amber-600 rounded-full w-7 h-7 flex items-center justify-center shadow-md transition-all scale-90 hover:scale-105"
              title="Add Sibling"
              onClick={(e) => {
                e.stopPropagation();
                onAddSibling(person.id);
              }}
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            {/* Top: + Parent */}
            <button
              className="pointer-events-auto absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-full w-7 h-7 flex items-center justify-center shadow-md transition-all scale-90 hover:scale-105"
              title="Add Parent"
              onClick={(e) => {
                e.stopPropagation();
                onAddParent(person.id);
              }}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>

            {/* Bottom: + Child */}
            <button
              className="pointer-events-auto absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-2.5 h-7 flex items-center justify-center gap-1 shadow-md transition-all scale-90 hover:scale-105 text-xs font-medium"
              title="Add Child"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(person.id);
              }}
            >
              <Baby className="w-3.5 h-3.5" />
              <span>Child</span>
            </button>

            {/* Right: + Partner */}
            <button
              className="pointer-events-auto absolute -right-3.5 top-1/2 -translate-y-1/2 bg-white border border-slate-300 hover:border-rose-500 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-full w-7 h-7 flex items-center justify-center shadow-md transition-all scale-90 hover:scale-105"
              title="Add Spouse / Partner"
              onClick={(e) => {
                e.stopPropagation();
                onAddPartner(person.id);
              }}
            >
              <Heart className="w-3.5 h-3.5" />
            </button>

            {/* Left: + Sibling */}
            <button
              className="pointer-events-auto absolute -left-3.5 top-1/2 -translate-y-1/2 bg-white border border-slate-300 hover:border-amber-500 hover:bg-amber-50 text-slate-700 hover:text-amber-600 rounded-full w-7 h-7 flex items-center justify-center shadow-md transition-all scale-90 hover:scale-105"
              title="Add Sibling"
              onClick={(e) => {
                e.stopPropagation();
                onAddSibling(person.id);
              }}
            >
              <Users className="w-3.5 h-3.5" />
            </button>

            {/* Collapse toggle button when branch is expanded */}
            {hasDescendants && !node.isCollapsed && onToggleCollapse && (
              <button
                className="pointer-events-auto absolute -bottom-3.5 right-2 bg-white border border-slate-300 hover:border-amber-500 hover:bg-amber-50 text-slate-500 hover:text-amber-600 rounded-full w-6 h-6 flex items-center justify-center shadow-md transition-all scale-90 hover:scale-105 z-30"
                title="Collapse descendants branch"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(person.id);
                }}
              >
                <ChevronUp className="w-3 h-3" />
              </button>
            )}
          </>
        )}
      </div>
      )}

      {/* Prominent Expand Badge when node is collapsed */}
      {node.isCollapsed && (
        <button
          className="pointer-events-auto absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-full px-2.5 py-0.5 flex items-center justify-center gap-1 shadow-md transition-all scale-95 hover:scale-105 text-[10px] font-bold z-40 border border-amber-400"
          title="Click to expand hidden descendants branch"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse?.(person.id);
          }}
        >
          <ChevronDown className="w-3 h-3" />
          <span>+{node.hiddenCount || 1} hidden</span>
        </button>
      )}
    </div>
  );
};
