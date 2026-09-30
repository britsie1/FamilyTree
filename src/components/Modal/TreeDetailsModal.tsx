import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { TreeData } from '../../types/tree';
import { useTreeStore } from '../../stores/useTreeStore';

export function TreeDetailsModal({ tree, isReadOnly, onClose }: { tree: TreeData; isReadOnly: boolean; onClose: () => void }) {
  const [name, setName] = useState(tree.name);
  const [description, setDescription] = useState(tree.description || '');
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  return createPortal(
    <dialog ref={dialogRef} onCancel={onClose} aria-labelledby="tree-details-title" className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-5 shadow-xl backdrop:bg-slate-900/60">
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!isReadOnly && name.trim()) {
          useTreeStore.getState().updateTreeDetails({ name, description });
          onClose();
        }
      }} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="tree-details-title" className="text-lg font-bold">Tree details</h2>
          <button type="button" onClick={onClose} aria-label="Close tree details" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div>
          <label htmlFor="tree-details-name" className="block text-sm font-medium">Tree name</label>
          <input id="tree-details-name" autoFocus required value={name} onChange={(event) => setName(event.target.value)} readOnly={isReadOnly} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent p-2" />
        </div>
        <div>
          <label htmlFor="tree-details-description" className="block text-sm font-medium">Description</label>
          <textarea id="tree-details-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} readOnly={isReadOnly} placeholder="Tell the story of this family tree…" className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent p-2 resize-y" />
        </div>
        {isReadOnly && <p className="text-xs text-slate-500">This tree is view only.</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer">{isReadOnly ? 'Close' : 'Cancel'}</button>
          {!isReadOnly && <button type="submit" disabled={!name.trim()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50 cursor-pointer">Save details</button>}
        </div>
      </form>
    </dialog>, document.body
  );
}