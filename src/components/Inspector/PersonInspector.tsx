import React, { useState, useMemo } from 'react';
import type { TreeLink, PersonDocument, Person } from '../../types/tree';
import { findRelationship, type RelationshipResult } from '../../services/relationshipFinder';
import { getPersonDisplayName } from '../../services/treeOperations';
import { useTreeStore } from '../../stores/useTreeStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { useTemporalStore } from '../../stores/useTemporalStore';
import { useModalStore } from '../../stores/useModalStore';
import { Sparkles, X } from 'lucide-react';

import { PersonHeader } from './PersonHeader';
import { PersonBioSection } from './PersonBioSection';
import { PersonVitalDatesSection } from './PersonVitalDatesSection';
import { PersonRelationshipsSection } from './PersonRelationshipsSection';
import { PersonCrossTreeLinksSection } from './PersonCrossTreeLinksSection';
import { PersonDocumentsSection } from './PersonDocumentsSection';

export interface PersonInspectorProps {
  relationship?: RelationshipResult | null;
  isFocused?: boolean;
  onToggleFocus?: (personId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (personId: string) => void;
  onClearComparison?: () => void;
  onClose?: () => void;
  onSelectPerson?: (personId: string) => void;
  onJumpToYear?: (year: number, moment?: any) => void;
  isReadOnly?: boolean;
  onOpenTreeLink?: (person: Person, link: TreeLink) => void;
  onLinkExistingTree?: (person: Person) => void;
  onRemoveTreeLink?: (personId: string, targetTreeId: string) => void;
  onOpenShareModal?: () => void;
  onPreviewDocument?: (doc: PersonDocument, personName: string) => void;
}

export const PersonInspector: React.FC<PersonInspectorProps> = ({
  relationship: propRelationship,
  isFocused: propIsFocused,
  onToggleFocus: propOnToggleFocus,
  isCollapsed: propIsCollapsed,
  onToggleCollapse: propOnToggleCollapse,
  onClearComparison: propOnClearComparison,
  onClose: propOnClose,
  onSelectPerson: propOnSelectPerson,
  onJumpToYear: propOnJumpToYear,
  isReadOnly: propIsReadOnly,
  onOpenTreeLink,
  onLinkExistingTree: propOnLinkExistingTree,
  onRemoveTreeLink,
  onOpenShareModal: propOnOpenShareModal,
  onPreviewDocument: propOnPreviewDocument,
}) => {
  const [isMobileMinimized, setIsMobileMinimized] = useState(false);

  // Tree store access
  const tree = useTreeStore((s) => s.tree);
  const updatePerson = useTreeStore((s) => s.updatePerson);
  const deletePerson = useTreeStore((s) => s.deletePerson);
  const unlinkPartnerAction = useTreeStore((s) => s.unlinkPartnerAction);
  const unlinkChildAction = useTreeStore((s) => s.unlinkChildAction);
  const unlinkParentFromChildAction = useTreeStore((s) => s.unlinkParentFromChildAction);

  // Canvas store access
  const selectedPersonId = useCanvasStore((s) => s.selectedPersonId);
  const comparisonPersonId = useCanvasStore((s) => s.comparisonPersonId);
  const focusPersonId = useCanvasStore((s) => s.focusPersonId);
  const collapsedPersonIds = useCanvasStore((s) => s.collapsedPersonIds);
  const selectPerson = useCanvasStore((s) => s.selectPerson);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const setComparisonPersonId = useCanvasStore((s) => s.setComparisonPersonId);
  const setSelectedUnionId = useCanvasStore((s) => s.setSelectedUnionId);
  const toggleFocus = useCanvasStore((s) => s.toggleFocus);
  const toggleCollapse = useCanvasStore((s) => s.toggleCollapse);

  // Collab & Temporal store access
  const userPermission = useCollabStore((s) => s.userPermission);
  const jumpToYear = useTemporalStore((s) => s.jumpToYear);

  // Modal store access
  const openShareModal = useModalStore((s) => s.openShareModal);
  const openPreviewDoc = useModalStore((s) => s.openPreviewDoc);
  const openLinkTreeModal = useModalStore((s) => s.openLinkTreeModal);
  const openRelationshipModal = useModalStore((s) => s.openRelationshipModal);

  // Effective state resolution
  const effectiveReadOnly = propIsReadOnly !== undefined ? propIsReadOnly : userPermission === 'viewer';
  const effectiveIsFocused = propIsFocused !== undefined ? propIsFocused : (focusPersonId === selectedPersonId);
  const effectiveIsCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : Boolean(selectedPersonId && collapsedPersonIds.has(selectedPersonId));

  // Resolved handlers
  const handleToggleFocus = propOnToggleFocus || ((id: string) => toggleFocus(id));
  const handleToggleCollapse = propOnToggleCollapse || ((id: string) => toggleCollapse(id));
  const handleClearComparison = propOnClearComparison || (() => setComparisonPersonId(null));
  const handleClose = propOnClose || (() => clearSelection());
  const handleSelectPerson = propOnSelectPerson || ((id: string) => selectPerson(id));
  const handleJumpToYear = propOnJumpToYear || ((y: number, m?: any) => jumpToYear(y, m));
  const handleOpenShareModal = propOnOpenShareModal || (() => openShareModal());
  const handlePreviewDocument = propOnPreviewDocument || ((doc: PersonDocument, name: string) => openPreviewDoc(doc, name));
  const handleLinkExistingTree = propOnLinkExistingTree || ((person: Person) => openLinkTreeModal(person));

  const handleDeletePerson = (id: string) => {
    deletePerson(id);
    if (selectedPersonId === id) {
      clearSelection();
    }
  };

  // Relationship between selected (A) and comparison (B)
  const calculatedRelationship = useMemo<RelationshipResult | null>(() => {
    if (!selectedPersonId || !comparisonPersonId) return null;
    return findRelationship(tree, selectedPersonId, comparisonPersonId);
  }, [tree, selectedPersonId, comparisonPersonId]);

  const relationship = propRelationship !== undefined ? propRelationship : calculatedRelationship;

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
        isFocused={effectiveIsFocused}
        onToggleFocus={handleToggleFocus}
        isCollapsed={effectiveIsCollapsed}
        onToggleCollapse={handleToggleCollapse}
        onClose={handleClose}
        onDeletePerson={handleDeletePerson}
        onAddChild={(id) => openRelationshipModal(id, 'child')}
        onUpdatePerson={updatePerson}
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
            onUpdatePerson={updatePerson}
          />

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Life & Dates */}
          <PersonVitalDatesSection
            person={person}
            tree={tree}
            isReadOnly={effectiveReadOnly}
            onUpdatePerson={updatePerson}
            onJumpToYear={handleJumpToYear}
          />

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Relationships */}
          <PersonRelationshipsSection
            person={person}
            tree={tree}
            isReadOnly={effectiveReadOnly}
            onSelectPerson={handleSelectPerson}
            onAddChild={(id) => openRelationshipModal(id, 'child')}
            onAddPartner={(id) => openRelationshipModal(id, 'partner')}
            onAddSibling={(id) => openRelationshipModal(id, 'sibling')}
            onAddParent={(id) => openRelationshipModal(id, 'parent')}
            onUnlinkPartner={unlinkPartnerAction}
            onUnlinkChild={unlinkChildAction}
            onUnlinkParentFromChild={unlinkParentFromChildAction}
            onEditUnion={setSelectedUnionId}
          />

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Cross-Tree Links */}
          <PersonCrossTreeLinksSection
            person={person}
            isReadOnly={effectiveReadOnly}
            onOpenTreeLink={onOpenTreeLink}
            onLinkExistingTree={handleLinkExistingTree}
            onRemoveTreeLink={onRemoveTreeLink}
          />

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Documents & Storage */}
          <PersonDocumentsSection
            person={person}
            tree={tree}
            isReadOnly={effectiveReadOnly}
            onUpdatePerson={updatePerson}
            onOpenShareModal={handleOpenShareModal}
            onPreviewDocument={handlePreviewDocument}
          />
        </div>
      )}
    </div>
  );
};
