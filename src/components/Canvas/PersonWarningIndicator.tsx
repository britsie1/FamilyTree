import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';
import type { HealthAnomaly } from '../../services/treeHealthAndStatsService';

export function PersonWarningIndicator({ issues, personId }: { issues: HealthAnomaly[]; personId: string }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();
  const open = hovered || focused || pinned;
  const hasError = issues.some((issue) => issue.severity === 'error');

  const enter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHovered(true);
  };
  const leave = () => {
    hoverTimer.current = setTimeout(() => setHovered(false), 150);
  };
  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 16);
      const height = tooltipRef.current?.offsetHeight || 0;
      setPosition({
        left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
        top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - height - 8)),
      });
    };
    updatePosition();
    const dismiss = () => {
      setPinned(false);
      setHovered(false);
      setFocused(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!buttonRef.current?.contains(event.target as Node) && !tooltipRef.current?.contains(event.target as Node)) dismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, issues]);

  return (
    <div
      className="absolute -top-2 right-1 z-50"
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        data-testid="person-card-warning"
        aria-label={`${issues.length} tree health ${issues.length === 1 ? 'issue' : 'issues'}`}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        className={`w-7 h-7 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 shadow-md cursor-pointer ${hasError ? 'bg-rose-600 text-white' : 'bg-amber-400 text-amber-950'}`}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={() => {
          setPinned(!pinned);
          setHovered(false);
          setFocused(false);
        }}
      >
        <TriangleAlert className="w-4 h-4" />
      </button>
      {open && createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          data-person-warning-id={personId}
          style={{ position: 'fixed', ...position, width: 'min(320px, calc(100vw - 16px))', zIndex: 1000 }}
          className="rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xl p-3 text-xs max-h-[50vh] overflow-y-auto space-y-2"
          onMouseEnter={enter}
          onMouseLeave={leave}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {issues.map((issue) => (
            <div key={issue.id}>
              <p className="font-semibold">{issue.title}</p>
              <p className="mt-0.5">{issue.description}</p>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}