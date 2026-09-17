import React from 'react';
import type { TreeData, UnionType } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import { X, Calendar, Trash2, Plus, Heart, HeartCrack, MinusCircle } from 'lucide-react';
import { DatePartsInput } from '../Common/DatePartsInput';

interface EditUnionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tree: TreeData;
  unionId: string | null;
  onUpdateUnion: (unionId: string, updates: Partial<{ type: UnionType; marriageDate?: string; divorceDate?: string }>) => void;
  onDeleteUnion: (unionId: string) => void;
  onAddChildToUnion: (unionId: string) => void;
  onSelectPerson: (personId: string) => void;
}

export const EditUnionModal: React.FC<EditUnionModalProps> = ({
  isOpen,
  onClose,
  tree,
  unionId,
  onUpdateUnion,
  onDeleteUnion,
  onAddChildToUnion,
  onSelectPerson,
}) => {
  if (!isOpen || !unionId) return null;

  const union = tree.unions[unionId];
  if (!union) return null;

  const partners = union.partnerIds.map((id) => tree.people[id]).filter(Boolean);
  const partnerNames = partners
    .map((p) => getPersonDisplayName(p))
    .join(' & ');

  const children = union.childrenIds.map((id) => tree.people[id]).filter(Boolean);

  const unionType: UnionType = union.type || 'married';

  const types: { key: UnionType; label: string; icon: React.ReactNode; color: string }[] = [
    {
      key: 'married',
      label: 'Married',
      icon: <Heart className="w-3.5 h-3.5 text-rose-500" />,
      color: 'hover:border-rose-300',
    },
    {
      key: 'divorced',
      label: 'Divorced',
      icon: <HeartCrack className="w-3.5 h-3.5 text-red-500" />,
      color: 'hover:border-red-300',
    },
    {
      key: 'separated',
      label: 'Separated',
      icon: <MinusCircle className="w-3.5 h-3.5 text-amber-500" />,
      color: 'hover:border-amber-300',
    },
    {
      key: 'partner',
      label: 'Partners / Unmarried',
      icon: <Heart className="w-3.5 h-3.5 text-indigo-500" />,
      color: 'hover:border-indigo-300',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${
              unionType === 'divorced'
                ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
            }`}>
              {unionType === 'divorced' ? <HeartCrack className="w-5 h-5" /> : <Heart className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-[240px]">
                {partnerNames || 'Relationship'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{unionType} Partnership</p>
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
          {/* Relationship Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
              Relationship Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onUpdateUnion(union.id, { type: t.key })}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    unionType === t.key
                      ? t.key === 'divorced'
                        ? 'bg-red-50 dark:bg-red-950/50 border-red-400 dark:border-red-750 text-red-800 dark:text-red-300 shadow-xs'
                        : 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 dark:border-indigo-600 text-indigo-900 dark:text-indigo-200 shadow-xs'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 ' + t.color
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Dates */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Dates
            </label>

            <div className="space-y-2.5">
              <div className="bg-slate-50/50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <DatePartsInput
                  label="Marriage Date"
                  icon={<Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />}
                  value={union.marriageDate}
                  onChange={(val) => onUpdateUnion(union.id, { marriageDate: val })}
                  yearPlaceholder="Marriage Year (YYYY)"
                />
              </div>

              {(unionType === 'divorced' || unionType === 'separated' || union.divorceDate) && (
                <div className="bg-red-50/30 dark:bg-red-950/30 p-2.5 rounded-xl border border-red-200 dark:border-red-900/60 animate-in fade-in duration-150">
                  <DatePartsInput
                    label="Divorce Date"
                    icon={<HeartCrack className="w-3.5 h-3.5 text-red-400" />}
                    value={union.divorceDate}
                    onChange={(val) => onUpdateUnion(union.id, { divorceDate: val })}
                    yearPlaceholder="Divorce Year (YYYY)"
                  />
                </div>
              )}
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Children with this union */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Children ({children.length})
              </span>
              <button
                onClick={() => {
                  onAddChildToUnion(union.id);
                  onClose();
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Child
              </button>
            </div>

            {children.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                No children attached to this union.
              </p>
            ) : (
              <div className="space-y-1">
                {children.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectPerson(c.id);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700/80 rounded-lg cursor-pointer transition-colors"
                  >
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      {getPersonDisplayName(c)}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono">
                      {c.birthDate ? c.birthDate.split('-')[0] : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to remove this marriage / partnership?')) {
                onDeleteUnion(union.id);
                onClose();
              }
            }}
            className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Relationship</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
