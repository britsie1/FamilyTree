import React, { useState } from 'react';
import type { TreeData, Person } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import { X, Search, UserPlus, Link2, Baby, Users, Heart, ArrowUp, User } from 'lucide-react';

export type RelationType = 'child' | 'sibling' | 'partner' | 'parent';

interface AddRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  tree: TreeData;
  sourcePersonId: string | null;
  relationType: RelationType;
  onCreateNew: () => void;
  onLinkExisting: (targetPersonId: string) => void;
}

export const AddRelationshipModal: React.FC<AddRelationshipModalProps> = ({
  isOpen,
  onClose,
  tree,
  sourcePersonId,
  relationType,
  onCreateNew,
  onLinkExisting,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen || !sourcePersonId) return null;

  const sourcePerson = tree.people[sourcePersonId];
  if (!sourcePerson) return null;

  const sourceName = getPersonDisplayName(sourcePerson);

  // Relation titles & metadata
  const getMeta = () => {
    switch (relationType) {
      case 'child':
        return {
          title: 'Add or Link Child',
          actionText: 'Link as Child',
          newText: 'Create New Child',
          icon: <Baby className="w-5 h-5 text-indigo-600" />,
          desc: `Add a child to ${sourceName}.`,
        };
      case 'partner':
        return {
          title: 'Add or Link Spouse / Partner',
          actionText: 'Link as Partner',
          newText: 'Create New Partner',
          icon: <Heart className="w-5 h-5 text-rose-600" />,
          desc: `Create a marriage or partnership with ${sourceName}.`,
        };
      case 'sibling':
        return {
          title: 'Add or Link Sibling',
          actionText: 'Link as Sibling',
          newText: 'Create New Sibling',
          icon: <Users className="w-5 h-5 text-amber-600" />,
          desc: `Connect a brother or sister to ${sourceName}.`,
        };
      case 'parent':
        return {
          title: 'Add or Link Parent',
          actionText: 'Link as Parent',
          newText: 'Create New Parent',
          icon: <ArrowUp className="w-5 h-5 text-blue-600" />,
          desc: `Connect a parent to ${sourceName}.`,
        };
    }
  };

  const meta = getMeta();

  // Filter candidates from existing people in tree
  const existingCandidates = Object.values(tree.people).filter((p: Person) => {
    // Cannot link person to themselves
    if (p.id === sourcePersonId) return false;

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const pName = `${p.firstName || ''} ${p.middleNames || ''} ${p.knownAs || ''} ${p.lastName || ''} ${p.maidenName || ''}`.toLowerCase();
      const notes = (p.notes || '').toLowerCase();
      if (!pName.includes(q) && !notes.includes(q) && !p.id.toLowerCase().includes(q)) {
        return false;
      }
    }

    // Exclude if already has this exact relationship
    if (relationType === 'partner') {
      // Check if already partners in any union
      const isAlreadyPartner = sourcePerson.unionIds.some((uId) => {
        const u = tree.unions[uId];
        return u && u.partnerIds.includes(p.id);
      });
      if (isAlreadyPartner) return false;
    }

    if (relationType === 'child') {
      // Check if already child of source person
      const isAlreadyChild = sourcePerson.unionIds.some((uId) => {
        const u = tree.unions[uId];
        return u && u.childrenIds.includes(p.id);
      });
      if (isAlreadyChild) return false;
    }

    if (relationType === 'parent') {
      // Check if already parent of source person
      if (sourcePerson.parentUnionId) {
        const pUnion = tree.unions[sourcePerson.parentUnionId];
        if (pUnion && pUnion.partnerIds.includes(p.id)) return false;
      }
    }

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs">
              {meta.icon}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{meta.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{meta.desc}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-sm">
          {/* Option A: Create New Person */}
          <div
            onClick={() => {
              onCreateNew();
              onClose();
            }}
            className="p-3.5 bg-gradient-to-r from-indigo-50/70 to-violet-50/50 hover:from-indigo-100/70 hover:to-violet-100/50 dark:from-indigo-950/40 dark:to-violet-950/30 dark:hover:from-indigo-950/60 dark:hover:to-violet-950/50 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl cursor-pointer transition-all group flex items-center justify-between shadow-xs hover:shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm group-hover:text-indigo-900 dark:group-hover:text-indigo-300">
                  {meta.newText}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add a brand new card to the tree with zero required fields.
                </p>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-indigo-600 group-hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer">
              Add New
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider absolute">
              Or Link Existing Relative
            </span>
          </div>

          {/* Option B: Search and Link Existing Person */}
          <div className="space-y-2">
            <div className="flex items-center bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-all">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search existing relatives by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Existing Candidates List */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {existingCandidates.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  No eligible relatives found.
                </div>
              ) : (
                existingCandidates.map((p) => {
                  const candidateName = getPersonDisplayName(p);
                  const birthYear = p.birthDate ? p.birthDate.split('-')[0] : '';
                  const initials = ((p.knownAs?.trim() || p.firstName)?.[0] || '') + (p.lastName?.[0] || '');

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onLinkExisting(p.id);
                        onClose();
                      }}
                      className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-xl cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-slate-200 dark:border-slate-600">
                          {initials || <User className="w-3.5 h-3.5 opacity-60" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                            {candidateName}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-400 truncate">
                            {birthYear ? `b. ${birthYear}` : 'No birth date'}
                            {p.knownAs?.trim() && p.firstName ? ` • Legal: ${p.firstName}` : ''}
                            {p.maidenName ? ` • née ${p.maidenName}` : ''}
                            {p.notes ? ` • ${p.notes}` : ''}
                          </p>
                        </div>
                      </div>

                      <button className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 px-2.5 py-1 rounded-lg flex-shrink-0 transition-colors cursor-pointer">
                        <Link2 className="w-3 h-3" />
                        <span>{meta.actionText}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-750 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
