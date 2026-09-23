import React, { memo } from 'react';
import type { LayoutNode, LayoutStyle, Person, TreeLink, PersonDocument } from '../../types/tree';
import { getPersonDisplayInfo } from '../../services/displayUtils';
import { getPersonTemporalInfo, type HistoricalMoment } from '../../services/temporalEngine';
import { getDirectImageUrl } from '../../services/googleDriveService';
import { arePersonCardPropsEqual } from './personCardMemo';
import { User, Heart, Baby, Users, ArrowUp, ArrowLeft, ChevronDown, ChevronUp, Sparkles, Cake, Check, GitFork, ExternalLink, Paperclip, GitCommit } from 'lucide-react';

export interface PersonCardProps {
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
  dragOffset?: { x: number; y: number } | null;
  onPortMouseDown?: (
    e: React.MouseEvent,
    personId: string,
    portType: 'parent' | 'child' | 'partner' | 'sibling',
    startX: number,
    startY: number
  ) => void;
  isConnectTarget?: boolean;
  onOpenTreeLink?: (person: Person, link: TreeLink) => void;
  onPreviewDocument?: (doc: PersonDocument, personName: string) => void;
  isBeaconActive?: boolean;
  isSearchMatch?: boolean;
  isSearchDimmed?: boolean;
}

const GENDER_STYLES: Record<string, { avatarBg: string; borderAccent: string }> = {
  male: {
    avatarBg: 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    borderAccent: 'border-l-blue-500',
  },
  female: {
    avatarBg: 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    borderAccent: 'border-l-rose-500',
  },
  other: {
    avatarBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    borderAccent: 'border-l-indigo-500',
  },
};

const PersonCardComponent: React.FC<PersonCardProps> = ({
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
  dragOffset = null,
  onPortMouseDown,
  isConnectTarget = false,
  onOpenTreeLink,
  onPreviewDocument,
  isBeaconActive = false,
  isSearchMatch = false,
  isSearchDimmed = false,
}) => {
  const { data: person, x, y, width, height } = node;
  const currentX = dragOffset ? x + dragOffset.x : x;
  const currentY = dragOffset ? y + dragOffset.y : y;

  const displayInfo = node.displayInfo ?? getPersonDisplayInfo(person);
  const { displayName, fullName, isUnnamed, initials, birthYear, standardDateText } = displayInfo;

  const hasDocuments = Boolean(person.documents && person.documents.length > 0);
  const documentCount = person.documents?.length || 0;
  const documentTooltip = hasDocuments
    ? `${documentCount} attached document${documentCount === 1 ? '' : 's'}: ${person.documents!.map((d) => d.name).join(', ')}`
    : '';

  const handleAttachmentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(person.id, e);
    if (person.documents && person.documents.length === 1) {
      onPreviewDocument?.(person.documents[0], displayName);
    }
  };

  // Temporal 4D calculations
  const isTemporalActive = temporalYear !== null && temporalYear !== undefined;
  const temporalInfo = isTemporalActive ? getPersonTemporalInfo(person, temporalYear) : null;
  const isUnborn = temporalInfo?.status === 'unborn';
  const isDeceasedAtYear = temporalInfo?.status === 'deceased';
  const isLivingAtYear = temporalInfo?.status === 'living';

  let dateText = standardDateText;
  if (isTemporalActive && temporalInfo) {
    if (isUnborn) {
      dateText = temporalInfo.ageLabel;
    } else if (isDeceasedAtYear) {
      dateText = temporalInfo.ageLabel;
    } else {
      dateText = `Age ${temporalInfo.age ?? '?'} (b. ${birthYear || '?'})`;
    }
  }

  const styles = (person.gender && GENDER_STYLES[person.gender]) || GENDER_STYLES.other;

  // Compute card style classes based on 4D temporal status
  let cardStateClasses = styles.borderAccent;
  if (isUnborn) {
    cardStateClasses = 'border-slate-300 dark:border-slate-700 border-dashed bg-slate-50/70 dark:bg-slate-900/60 opacity-20 hover:opacity-50 grayscale';
  } else if (isDeceasedAtYear) {
    cardStateClasses = 'border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900/80 grayscale opacity-45 hover:opacity-75';
  } else if (isRoomHonoree) {
    cardStateClasses = 'ring-3 ring-amber-500 border-amber-500 bg-amber-50/40 dark:bg-amber-950/40 shadow-xl z-35 animate-pulse';
  } else if (isTemporalActive && isLivingAtYear) {
    cardStateClasses = `${styles.borderAccent} ring-1 ring-emerald-500/70 border-emerald-400 shadow-md`;
  }

  const isPathDimmed = hasActiveComparison && !isOnRelationshipPath && !isSelected && !isCompared && !isBeaconActive;

  return (
    <div
      data-testid="person-card"
      data-person-id={person.id}
      style={{
        position: 'absolute',
        transform: `translate(${currentX}px, ${currentY}px)`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      className={`group select-none pointer-events-auto transition-all duration-200 cursor-grab active:cursor-grabbing rounded-xl bg-white dark:bg-slate-900 border border-l-4 shadow-sm ${cardStateClasses} ${
        isBeaconActive
          ? 'ring-4 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-950 border-indigo-500 shadow-2xl z-45'
          : isConnectTarget
          ? 'ring-4 ring-indigo-500/80 border-indigo-500 shadow-2xl z-40 scale-[1.03] animate-pulse'
          : isSelected || isMultiSelected
          ? 'ring-2 ring-indigo-600 border-indigo-600 shadow-lg z-30'
          : isCompared
          ? 'ring-2 ring-purple-600 border-purple-600 shadow-lg z-30'
          : isOnRelationshipPath
          ? 'ring-4 ring-indigo-500 border-indigo-600 shadow-xl z-35 bg-indigo-50/25 dark:bg-indigo-950/40'
          : isSearchMatch
          ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-lg scale-[1.02] z-30'
          : isHovered
          ? 'border-slate-400 dark:border-slate-600 shadow-md z-20'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 z-10'
      } ${
        isSearchDimmed && !isBeaconActive && !isSelected
          ? 'opacity-25 grayscale hover:opacity-75 transition-opacity'
          : isPathDimmed
          ? 'opacity-35 grayscale-[40%] hover:opacity-80 transition-opacity'
          : ''
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
      {/* Interactive Beacon Radar Pulse (Target Locate) */}
      {isBeaconActive && (
        <div
          aria-hidden="true"
          className="absolute -inset-3 rounded-2xl pointer-events-none z-50 overflow-visible"
        >
          {/* Expanding radar ping wave 1 */}
          <span className="absolute inset-0 rounded-2xl border-2 border-indigo-500 bg-indigo-500/25 animate-ping opacity-80 duration-1000" />
          {/* Expanding radar ping wave 2 (offset) */}
          <span className="absolute -inset-2 rounded-2xl border border-indigo-400 bg-indigo-400/15 animate-ping opacity-60 duration-1500 delay-300" />
          {/* Pulsing vibrant outer glow halo */}
          <span className="absolute -inset-1 rounded-2xl ring-4 ring-indigo-500/80 shadow-[0_0_30px_rgba(99,102,241,0.7)] animate-pulse" />
        </div>
      )}

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
          className="absolute -top-2.5 -left-2 bg-indigo-600 text-white text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg z-35 ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-75 duration-150"
        >
          A
        </span>
      )}
      {isCompared && (
        <span
          title="Comparison Target (B)"
          className="absolute -top-2.5 -right-2 bg-purple-600 text-white text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg z-35 ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-75 duration-150"
        >
          B
        </span>
      )}
      {isOnRelationshipPath && !isSelected && !isCompared && (
        <span
          title="On Relationship Connection Path"
          className="absolute -top-2.5 right-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-35 flex items-center gap-1 border border-indigo-300 dark:border-indigo-700 animate-in zoom-in-75 duration-150"
        >
          <GitCommit className="w-3 h-3" />
          <span>Path</span>
        </span>
      )}

      {/* Linked Trees Indicator Badge */}
      {person.linkedTrees && person.linkedTrees.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenTreeLink?.(person, person.linkedTrees![0]);
          }}
          title={`Linked to: ${person.linkedTrees.map((l) => l.treeName).join(', ')}\nClick to jump to this family tree`}
          className={`absolute ${
            isRoomHonoree || isCompared ? '-top-2.5 right-14' : '-top-2.5 right-2'
          } bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-35 flex items-center gap-1 border border-indigo-400 hover:scale-105 transition-all cursor-pointer pointer-events-auto group/treebtn animate-in fade-in duration-150`}
        >
          <GitFork className="w-3 h-3 rotate-90" />
          <span className="max-w-[85px] truncate">
            {person.linkedTrees.length === 1 ? person.linkedTrees[0].treeName : `${person.linkedTrees.length} trees`}
          </span>
          <ExternalLink className="w-2.5 h-2.5 opacity-80 group-hover/treebtn:opacity-100" />
        </button>
      )}

      <div className="flex items-center gap-3 p-2.5 h-full relative">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border overflow-hidden shadow-inner ${styles.avatarBg} ${
              isUnborn ? 'opacity-40' : ''
            }`}
          >
            {person.avatarUrl ? (
              <img
                src={getDirectImageUrl(person.avatarUrl)}
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

          {/* Attachment Indicator Badge on Avatar */}
          {hasDocuments && (
            <button
              type="button"
              data-testid="person-card-attachment-badge"
              title={documentTooltip}
              onClick={handleAttachmentClick}
              className={`absolute -bottom-1 -right-1 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-full shadow-md border-2 border-white dark:border-slate-900 flex items-center justify-center cursor-pointer pointer-events-auto transition-transform hover:scale-110 z-10 ${
                documentCount > 1 ? 'px-1.5 h-5 gap-0.5 text-[10px] font-bold' : 'w-5 h-5'
              }`}
            >
              <Paperclip className="w-2.5 h-2.5 stroke-[2.5]" />
              {documentCount > 1 && <span>{documentCount}</span>}
            </button>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <h4
              className={`text-sm font-semibold truncate leading-tight ${
                isUnborn
                  ? 'text-slate-400 dark:text-slate-500 font-normal italic'
                  : isUnnamed
                  ? 'text-slate-400 dark:text-slate-500 italic'
                  : 'text-slate-800 dark:text-slate-100'
              }`}
              title={person.knownAs?.trim() && (person.firstName || person.middleNames) ? `${displayName} (${fullName})` : fullName}
            >
              {displayName}
            </h4>
            {person.isDeceased && !isTemporalActive && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded font-normal flex-shrink-0">
                ✝
              </span>
            )}
            {person.linkedTrees && person.linkedTrees.length > 0 && (
              <span
                title={`Linked to: ${person.linkedTrees.map((t) => t.treeName).join(', ')}. Click to jump.`}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer flex items-center flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTreeLink?.(person, person.linkedTrees![0]);
                }}
              >
                <GitFork className="w-3.5 h-3.5 rotate-90" />
              </span>
            )}
            {hasDocuments && (
              <button
                type="button"
                data-testid="person-card-attachment-icon"
                title={documentTooltip}
                onClick={handleAttachmentClick}
                className="text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 cursor-pointer flex items-center flex-shrink-0 transition-colors p-0.5 rounded hover:bg-amber-50 dark:hover:bg-amber-950/40"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
            )}
          </div>


          {person.maidenName && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
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
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate italic">
                      {person.notes}
                    </span>
                  )}
                </div>
              ) : isDeceasedAtYear ? (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                  <span className="text-slate-400 dark:text-slate-500">✝</span> {temporalInfo.ageLabel}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                  {temporalInfo.ageLabel}
                </span>
              )}
            </div>
          ) : (
            dateText && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono mt-0.5 leading-tight">
                {dateText}
              </p>
            )
          )}

          {!isTemporalActive && person.birthPlace && !dateText && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate leading-tight mt-0.5">
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
            {/* Left: + Parent */}
            <button
              className="pointer-events-auto absolute -left-4 sm:-left-3.5 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center shadow-md transition-all scale-95 hover:scale-110 cursor-crosshair active:scale-90"
              title="Click to add parent or drag cable to connect"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPortMouseDown?.(e, person.id, 'parent', currentX, currentY + height / 2);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAddParent(person.id);
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

            {/* Right: + Child */}
            <button
              className="pointer-events-auto absolute -right-4 sm:-right-3.5 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-3 sm:px-2.5 h-8 sm:h-7 flex items-center justify-center gap-1 shadow-md transition-all scale-95 hover:scale-110 cursor-crosshair text-xs font-medium active:scale-90"
              title="Click to add child or drag cable to connect"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPortMouseDown?.(e, person.id, 'child', currentX + width, currentY + height / 2);
              }}
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
              className="pointer-events-auto absolute -top-4 sm:-top-3.5 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 rounded-full w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center shadow-md transition-all scale-95 hover:scale-110 cursor-crosshair active:scale-90"
              title="Click to add spouse or drag cable to connect"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPortMouseDown?.(e, person.id, 'partner', currentX + width / 2, currentY);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAddPartner(person.id);
              }}
            >
              <Heart className="w-3.5 h-3.5" />
            </button>

            {/* Bottom: + Sibling */}
            <button
              className="pointer-events-auto absolute -bottom-4 sm:-bottom-3.5 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 rounded-full w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center shadow-md transition-all scale-95 hover:scale-110 cursor-crosshair active:scale-90"
              title="Click to add sibling or drag cable to connect"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPortMouseDown?.(e, person.id, 'sibling', currentX + width / 2, currentY + height);
              }}
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
              className="pointer-events-auto absolute -top-4 sm:-top-3.5 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center shadow-md transition-all scale-95 hover:scale-110 cursor-crosshair active:scale-90"
              title="Click to add parent or drag cable to connect"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPortMouseDown?.(e, person.id, 'parent', currentX + width / 2, currentY);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAddParent(person.id);
              }}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>

            {/* Bottom: + Child */}
            <button
              className="pointer-events-auto absolute -bottom-4 sm:-bottom-3.5 left-1/2 -translate-x-1/2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-3 sm:px-2.5 h-8 sm:h-7 flex items-center justify-center gap-1 shadow-md transition-all scale-95 hover:scale-110 cursor-crosshair text-xs font-medium active:scale-90"
              title="Click to add child or drag cable to connect"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPortMouseDown?.(e, person.id, 'child', currentX + width / 2, currentY + height);
              }}
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
              className="pointer-events-auto absolute -right-4 sm:-right-3.5 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 rounded-full w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center shadow-md transition-all scale-95 hover:scale-110 cursor-crosshair active:scale-90"
              title="Click to add spouse or drag cable to connect"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPortMouseDown?.(e, person.id, 'partner', currentX + width, currentY + height / 2);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAddPartner(person.id);
              }}
            >
              <Heart className="w-3.5 h-3.5" />
            </button>

            {/* Left: + Sibling */}
            <button
              className="pointer-events-auto absolute -left-4 sm:-left-3.5 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 rounded-full w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center shadow-md transition-all scale-95 hover:scale-110 cursor-crosshair active:scale-90"
              title="Click to add sibling or drag cable to connect"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPortMouseDown?.(e, person.id, 'sibling', currentX, currentY + height / 2);
              }}
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
                className="pointer-events-auto absolute -bottom-4 sm:-bottom-3.5 right-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-full w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center shadow-md transition-all scale-95 hover:scale-105 z-30"
                title="Collapse descendants branch"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(person.id);
                }}
              >
                <ChevronUp className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
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

export const PersonCard = memo(PersonCardComponent, arePersonCardPropsEqual);


