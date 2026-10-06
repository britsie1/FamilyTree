import React from 'react';
import type { Person, TreeData, ParentLinkType } from '../../types/tree';
import { getPersonDisplayName, getParentLinks } from '../../services/treeOperations';
import { useTreeStore } from '../../stores/useTreeStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useCollabStore } from '../../stores/useCollabStore';
import {
  ArrowUp,
  Users,
  Heart,
  Baby,
  Plus,
  ExternalLink,
  Unlink,
} from 'lucide-react';

export interface PersonRelationshipsSectionProps {
  person: Person;
  tree?: TreeData;
  isReadOnly?: boolean;
  onSelectPerson?: (personId: string) => void;
  onAddChild?: (personId: string) => void;
  onAddPartner?: (personId: string) => void;
  onAddSibling?: (personId: string) => void;
  onAddParent?: (personId: string) => void;
  onUnlinkPartner?: (personId: string, unionId: string) => void;
  onUnlinkChild?: (childPersonId: string, unionId?: string) => void;
  onUnlinkParentFromChild?: (childPersonId: string, parentPersonId: string) => void;
  onEditUnion?: (unionId: string) => void;
}

export const PersonRelationshipsSection: React.FC<PersonRelationshipsSectionProps> = ({
  person,
  tree: propTree,
  isReadOnly: propIsReadOnly,
  onSelectPerson,
  onAddChild,
  onAddPartner,
  onAddSibling,
  onAddParent,
  onUnlinkPartner,
  onUnlinkChild,
  onUnlinkParentFromChild,
  onEditUnion,
}) => {
  // Store access
  const storeTree = useTreeStore((s) => s.tree);
  const storeUnlinkPartner = useTreeStore((s) => s.unlinkPartnerAction);
  const storeUnlinkChild = useTreeStore((s) => s.unlinkChildAction);
  const storeUnlinkParentFromChild = useTreeStore((s) => s.unlinkParentFromChildAction);
  const storeUpdateParentLinkType = useTreeStore((s) => s.updateParentLinkTypeAction);
  const storeSelectPerson = useCanvasStore((s) => s.selectPerson);
  const storeSetSelectedUnionId = useCanvasStore((s) => s.setSelectedUnionId);
  const storeUserPermission = useCollabStore((s) => s.userPermission);

  const tree = propTree || storeTree;
  const isReadOnly = propIsReadOnly !== undefined ? propIsReadOnly : storeUserPermission === 'viewer';
  const handleSelectPerson = onSelectPerson || storeSelectPerson;
  const handleEditUnion = onEditUnion || storeSetSelectedUnionId;
  const handleUnlinkPartner = onUnlinkPartner || storeUnlinkPartner;
  const handleUnlinkChild = onUnlinkChild || storeUnlinkChild;
  const handleUnlinkParentFromChild = onUnlinkParentFromChild || storeUnlinkParentFromChild;

  const displayName = getPersonDisplayName(person);

  // Find parents with relationship type metadata
  const parentLinks = getParentLinks(person);
  const parentGroups: { unionId: string; type: ParentLinkType; isPrimary?: boolean; parents: Person[] }[] = [];
  const seenUnionIds = new Set<string>();

  for (const link of parentLinks) {
    if (seenUnionIds.has(link.unionId)) continue;
    seenUnionIds.add(link.unionId);
    const u = tree.unions[link.unionId];
    if (u) {
      const parentPeople = u.partnerIds.map((id) => tree.people[id]).filter(Boolean);
      parentGroups.push({
        unionId: link.unionId,
        type: link.type,
        isPrimary: link.isPrimary,
        parents: parentPeople,
      });
    }
  }

  // Find siblings across all parent unions
  const siblings: Person[] = [];
  const seenSiblingIds = new Set<string>();
  for (const link of parentLinks) {
    const u = tree.unions[link.unionId];
    if (u && u.childrenIds) {
      u.childrenIds.forEach((cId) => {
        if (cId !== person.id && tree.people[cId] && !seenSiblingIds.has(cId)) {
          seenSiblingIds.add(cId);
          siblings.push(tree.people[cId]);
        }
      });
    }
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
    <div className="space-y-4">
      <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Family Links</h4>

      {/* Parents */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
            <ArrowUp className="w-3 h-3 text-blue-500" /> Parents
          </span>
          {!isReadOnly && onAddParent && (
            <button
              onClick={() => onAddParent(person.id)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add / Link
            </button>
          )}
        </div>
        {parentGroups.length === 0 || parentGroups.every((g) => g.parents.length === 0) ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">No parents attached</p>
        ) : (
          <div className="space-y-2">
            {parentGroups.map((group) => (
              <div key={group.unionId} className="space-y-1">
                {group.parents.map((p) => (
                  <div
                    key={`${group.unionId}_${p.id}`}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg group transition-colors"
                  >
                    <div
                      onClick={() => handleSelectPerson(p.id)}
                      className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
                    >
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {getPersonDisplayName(p)}
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex-shrink-0" />
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!isReadOnly ? (
                        <select
                          value={group.type}
                          onChange={(e) => {
                            storeUpdateParentLinkType(person.id, group.unionId, e.target.value as ParentLinkType, p.id);
                          }}
                          className="text-[10px] font-medium py-0.5 px-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="biological">Biological</option>
                          <option value="adoptive">Adoptive</option>
                          <option value="step">Step</option>
                          <option value="foster">Foster</option>
                          <option value="unknown">Unknown</option>
                        </select>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-medium capitalize">
                          {group.type}
                        </span>
                      )}

                      {!isReadOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Unlink ${displayName} from parent ${getPersonDisplayName(p)}?`)) {
                              handleUnlinkParentFromChild(person.id, p.id);
                            }
                          }}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-all cursor-pointer"
                          title="Unlink from this parent"
                        >
                          <Unlink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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
          {!isReadOnly && onAddSibling && (
            <button
              onClick={() => onAddSibling(person.id)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add / Link
            </button>
          )}
        </div>
        {siblings.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">No siblings attached</p>
        ) : (
          <div className="space-y-1">
            {siblings.map((sib) => (
              <div
                key={sib.id}
                onClick={() => handleSelectPerson(sib.id)}
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
          {!isReadOnly && onAddPartner && (
            <button
              onClick={() => onAddPartner(person.id)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add / Link
            </button>
          )}
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
                    onClick={() => handleSelectPerson(sp.id)}
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
                        handleEditUnion(unionId);
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

                    {!isReadOnly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `Unlink partnership between ${displayName} and ${getPersonDisplayName(sp)}?\n\nTip: If they are divorced or separated, click the status button "${uType}" instead to change relationship status without unlinking.`
                            )
                          ) {
                            handleUnlinkPartner(person.id, unionId);
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
          {!isReadOnly && onAddChild && (
            <button
              onClick={() => onAddChild(person.id)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add / Link
            </button>
          )}
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
                  onClick={() => handleSelectPerson(ch.id)}
                  className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
                >
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                    {getPersonDisplayName(ch)}
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex-shrink-0" />
                </div>

                {!isReadOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Unlink child ${getPersonDisplayName(ch)} from parent?`)) {
                        const viaUnionId = person.unionIds.find((uId) =>
                          tree.unions[uId]?.childrenIds.includes(ch.id)
                        );
                        handleUnlinkChild(ch.id, viaUnionId);
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
    </div>
  );
};
