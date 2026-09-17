import React from 'react';
import type { Person, TreeLink } from '../../types/tree';
import { useTreeStore } from '../../stores/useTreeStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { GitFork, Plus, ExternalLink, Unlink } from 'lucide-react';

export interface PersonCrossTreeLinksSectionProps {
  person: Person;
  isReadOnly?: boolean;
  onOpenTreeLink?: (person: Person, link: TreeLink) => void;
  onLinkExistingTree?: (person: Person) => void;
  onRemoveTreeLink?: (personId: string, targetTreeId: string) => void;
}

export const PersonCrossTreeLinksSection: React.FC<PersonCrossTreeLinksSectionProps> = ({
  person,
  isReadOnly: propIsReadOnly,
  onOpenTreeLink,
  onLinkExistingTree,
  onRemoveTreeLink,
}) => {
  const storeUpdatePerson = useTreeStore((s) => s.updatePerson);
  const storeUserPermission = useCollabStore((s) => s.userPermission);

  const isReadOnly = propIsReadOnly !== undefined ? propIsReadOnly : storeUserPermission === 'viewer';

  const handleRemove = (treeId: string) => {
    if (onRemoveTreeLink) {
      onRemoveTreeLink(person.id, treeId);
    } else {
      const filtered = (person.linkedTrees || []).filter((l) => l.treeId !== treeId);
      storeUpdatePerson(person.id, { linkedTrees: filtered });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
          <GitFork className="w-3 h-3 text-indigo-600 dark:text-indigo-400 rotate-90" /> Linked Trees
        </span>
        {!isReadOnly && onLinkExistingTree && (
          <button
            type="button"
            onClick={() => onLinkExistingTree(person)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Link Tree
          </button>
        )}
      </div>

      {!person.linkedTrees || person.linkedTrees.length === 0 ? (
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
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Remove link to "${link.treeName}"?`)) {
                        handleRemove(link.treeId);
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
  );
};
