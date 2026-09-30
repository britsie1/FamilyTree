import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface MoreMenuAction {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  section: string;
}

export function MoreMenu({ actions }: { actions: MoreMenuAction[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div ref={rootRef} className="relative">
      <button ref={buttonRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls="more-menu" onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
        More <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && <div ref={menuRef} id="more-menu" role="menu" aria-label="More actions" onKeyDown={(event) => {
        const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') || []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        let next: number | undefined;
        if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next !== undefined) { event.preventDefault(); buttons[next]?.focus(); }
        if (event.key === 'Tab') setOpen(false);
      }} className="absolute right-0 top-full mt-2 w-64 max-h-[75dvh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 shadow-xl z-50">
        {actions.map((action, index) => <React.Fragment key={action.label}>
          {(index === 0 || actions[index - 1].section !== action.section) && <div role="presentation" className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{action.section}</div>}
          <button type="button" role="menuitem" tabIndex={-1} onClick={() => { setOpen(false); buttonRef.current?.focus(); action.onClick(); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-indigo-50 dark:hover:bg-slate-800 focus:bg-indigo-50 dark:focus:bg-slate-800 cursor-pointer">
            {action.icon}{action.label}
          </button>
        </React.Fragment>)}
      </div>}
    </div>
  );
}