import React, { useState } from 'react';
import type { TreeData, Person, TreeLink, PersonDocument } from '../../types/tree';
import type { RelationshipResult } from '../../services/relationshipFinder';
import { getPersonDisplayName } from '../../services/treeOperations';
import { useTreeStore } from '../../stores/useTreeStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { Sparkles, X } from 'lucide-react';

import { PersonHeader } from './PersonHeader';
import { PersonBioSection } from './PersonBioSection';
import { PersonVitalDatesSection } from './PersonVitalDatesSection';
import { PersonRelationshipsSection } from './PersonRelationshipsSection';
import { PersonCrossTreeLinksSection } from './PersonCrossTreeLinksSection';
import { PersonDocumentsSection } from './PersonDocumentsSection';

export interface PersonInspectorProps {
  tree?: TreeData;
  selectedPersonId?: string | null;
  comparisonPersonId?: string | null;
  relationship?: RelationshipResult | null;
  isFocused?: boolean;
  onToggleFocus?: (personId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (personId: string) => void;
  onClearComparison?: () => void;
  onClose?: () => void;
  onUpdatePerson?: (personId: string, updates: Partial<Person>) => void;
  onDeletePerson?: (personId: string) => void;
  onSelectPerson?: (personId: string) => void;
  onAddChild?: (personId: string) => void;
  onAddPartner?: (personId: string) => void;
  onAddSibling?: (personId: string) => void;
  onAddParent?: (personId: string) => void;
  onUnlinkPartner?: (personId: string, unionId: string) => void;
  onUnlinkChild?: (childPersonId: string) => void;
  onUnlinkParentFromChild?: (childPersonId: string, parentPersonId: string) => void;
  onEditUnion?: (unionId: string) => void;
  onJumpToYear?: (year: number, moment?: any) => void;
  isReadOnly?: boolean;
  onOpenTreeLink?: (person: Person, link: TreeLink) => void;
  onLinkExistingTree?: (person: Person) => void;
  onRemoveTreeLink?: (personId: string, targetTreeId: string) => void;
  onOpenShareModal?: () => void;
  onPreviewDocument?: (doc: PersonDocument, personName: string) => void;
}

export const PersonInspector: React.FC<PersonInspectorProps> = ({
  tree: propTree,
  selectedPersonId: propSelectedPersonId,
  comparisonPersonId: propComparisonPersonId,
  relationship,
  isFocused,
  onToggleFocus,
  isCollapsed,
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
  isReadOnly,
  onOpenTreeLink,
  onLinkExistingTree,
  onRemoveTreeLink,
  onOpenShareModal,
  onPreviewDocument,
}) => {
  const [isMobileMinimized, setIsMobileMinimized] = useState(false);

  // Store access
  const storeTree = useTreeStore((s) => s.tree);
  const storeSelectedPersonId = useCanvasStore((s) => s.selectedPersonId);
  const storeComparisonPersonId = useCanvasStore((s) => s.comparisonPersonId);
  const storeSetComparisonPersonId = useCanvasStore((s) => s.setComparisonPersonId);
  const storeUserPermission = useCollabStore((s) => s.userPermission);

  const tree = propTree || storeTree;
  const selectedPersonId = propSelectedPersonId !== undefined ? propSelectedPersonId : storeSelectedPersonId;
  const comparisonPersonId = propComparisonPersonId !== undefined ? propComparisonPersonId : storeComparisonPersonId;
  const effectiveReadOnly = isReadOnly !== undefined ? isReadOnly : storeUserPermission === 'viewer';

  const handleClearComparison = onClearComparison || (() => storeSetComparisonPersonId(null));

  if (!selectedPersonId) return null;

  const person = tree.people[selectedPersonId];
  if (!person) return null;

  const comparisonPerson = comparisonPersonId ? tree.people[comparisonPersonId] : null;

  return (
    <div
      role="region"
      aria-label="Person Inspector"
      data-testid="person-inspector"
      className={`fixed inset-x-0 bottom-0 ${
        isMobileMinimized ? 'max-h-24' : 'max-h-[85dvh]'
      } w-full bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 z-50 flex flex-col transition-all duration-300 sm:top-0 sm:right-0 sm:bottom-auto sm:left-auto sm:w-96 sm:h-full sm:max-h-full sm:rounded-none sm:border-t-0 sm:border-l sm:border-slate-200 sm:dark:border-slate-800 pb-[env(safe-area-inset-bottom,0px)]`}
    >
      {/* Header, Peek Bar & Focus Controls */}
      <PersonHeader
        person={person}
        tree={tree}
        isMobileMinimized={isMobileMinimized}
        onToggleMobileMinimized={() => setIsMobileMinimized((prev) => !prev)}
        isReadOnly={effectiveReadOnly}
        isFocused={isFocused}
        onToggleFocus={onToggleFocus}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        onClose={onClose}
        onDeletePerson={onDeletePerson}
        onAddChild={onAddChild}
        onUpdatePerson={onUpdatePerson}
      />

      {!isMobileMinimized && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
          {/* Kinship Comparison Box or Discovery Tip */}
          {relationship && comparisonPerson ? (
            <div className="bg-gradient-to-br from-indigo-50/90 to-purple-50/90 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl p-3 shadow-2xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wide flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Compared with
                </span>
                <button
                  type="button"
                  onClick={handleClearComparison}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-700/50 cursor-pointer"
                  title="Clear comparison"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center border border-purple-300 dark:border-purple-800">
                  B
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white text-xs truncate">
                    {getPersonDisplayName(comparisonPerson)}
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

          {/* Identity & Bio */}
          <PersonBioSection
            person={person}
            tree={tree}
            isReadOnly={effectiveReadOnly}
            onUpdatePerson={onUpdatePerson}
          />

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Life & Dates */}
          <PersonVitalDatesSection
            person={person}
            tree={tree}
            isReadOnly={effectiveReadOnly}
            onUpdatePerson={onUpdatePerson}
            onJumpToYear={onJumpToYear}
          />

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Relationships */}
          <PersonRelationshipsSection
            person={person}
            tree={tree}
            isReadOnly={effectiveReadOnly}
            onSelectPerson={onSelectPerson}
            onAddChild={onAddChild}
            onAddPartner={onAddPartner}
            onAddSibling={onAddSibling}
            onAddParent={onAddParent}
            onUnlinkPartner={onUnlinkPartner}
            onUnlinkChild={onUnlinkChild}
            onUnlinkParentFromChild={onUnlinkParentFromChild}
            onEditUnion={onEditUnion}
          />

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Cross-Tree Links */}
          <PersonCrossTreeLinksSection
            person={person}
            isReadOnly={effectiveReadOnly}
            onOpenTreeLink={onOpenTreeLink}
            onLinkExistingTree={onLinkExistingTree}
            onRemoveTreeLink={onRemoveTreeLink}
          />

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Documents & Storage */}
          <PersonDocumentsSection
            person={person}
            tree={tree}
            isReadOnly={effectiveReadOnly}
            onUpdatePerson={onUpdatePerson}
            onOpenShareModal={onOpenShareModal}
            onPreviewDocument={onPreviewDocument}
          />
        </div>
      )}
    </div>
  );
};
