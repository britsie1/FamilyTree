import React, { useEffect } from 'react';
import {
  X,
  Keyboard,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Clock,
  Map,
  ArrowRight,
  Activity,
  Search,
  Undo2,
  Redo2,
  Trash2,
  MousePointer,
  Sparkles,
} from 'lucide-react';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const navigationShortcuts: ShortcutItem[] = [
    {
      keys: ['F'],
      label: 'Fit to Screen',
      description: 'Center and scale full tree into view',
      icon: <Maximize2 className="w-3.5 h-3.5" />,
    },
    {
      keys: ['+', '='],
      label: 'Zoom In',
      description: 'Zoom in closer to cards',
      icon: <ZoomIn className="w-3.5 h-3.5" />,
    },
    {
      keys: ['-', '_'],
      label: 'Zoom Out',
      description: 'Zoom out for wide perspective',
      icon: <ZoomOut className="w-3.5 h-3.5" />,
    },
    {
      keys: ['0'],
      label: 'Reset Zoom (100%)',
      description: 'Reset zoom level to default 1:1 scale',
      icon: <RotateCcw className="w-3.5 h-3.5" />,
    },
    {
      keys: ['←', '→'],
      label: 'Timeline Scrub',
      description: 'Step back or forward 1 year in 4D mode',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    {
      keys: ['Shift', 'Drag'],
      label: 'Marquee Selection',
      description: 'Draw a selection rectangle across relatives',
      icon: <MousePointer className="w-3.5 h-3.5" />,
    },
  ];

  const toolsShortcuts: ShortcutItem[] = [
    {
      keys: ['?'],
      label: 'Keyboard Shortcuts',
      description: 'Show this hotkeys reference guide',
      icon: <Keyboard className="w-3.5 h-3.5" />,
    },
    {
      keys: ['T'],
      label: '4D Temporal Timeline',
      description: 'Toggle timeline scrub bar & life moments',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    {
      keys: ['M'],
      label: 'MiniMap Radar',
      description: 'Toggle viewport radar navigator',
      icon: <Map className="w-3.5 h-3.5" />,
    },
    {
      keys: ['L'],
      label: 'Toggle Layout',
      description: 'Switch between Top-Down and Left-to-Right',
      icon: <ArrowRight className="w-3.5 h-3.5" />,
    },
    {
      keys: ['H'],
      label: 'Tree Health & Stats',
      description: 'Open data quality audit and demographics',
      icon: <Activity className="w-3.5 h-3.5" />,
    },
    {
      keys: ['/'],
      label: 'Search Relatives',
      description: 'Focus name and legal relative search bar',
      icon: <Search className="w-3.5 h-3.5" />,
    },
  ];

  const editingShortcuts: ShortcutItem[] = [
    {
      keys: ['Ctrl', 'Z'],
      label: 'Undo Action',
      description: 'Revert previous tree alteration or drag',
      icon: <Undo2 className="w-3.5 h-3.5" />,
    },
    {
      keys: ['Ctrl', 'Y'],
      label: 'Redo Action',
      description: 'Reapply undone modification',
      icon: <Redo2 className="w-3.5 h-3.5" />,
    },
    {
      keys: ['Del', 'Backspace'],
      label: 'Delete Relative',
      description: 'Delete selected person from tree',
      icon: <Trash2 className="w-3.5 h-3.5" />,
    },
    {
      keys: ['Ctrl', 'Click'],
      label: 'Kinship Comparison',
      description: 'Select two people to compute direct kinship',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    {
      keys: ['Esc'],
      label: 'Escape / Clear',
      description: 'Deselect, cancel wiring cable, close dialogs',
      icon: <X className="w-3.5 h-3.5" />,
    },
  ];

  const renderSection = (title: string, items: ShortcutItem[]) => (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                {item.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {item.label}
                </p>
                {item.description && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {item.keys.map((k, kIdx) => (
                <kbd
                  key={kIdx}
                  className="px-2 py-0.5 text-[11px] font-mono font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg shadow-2xs"
                >
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] max-h-[85dvh] overflow-hidden animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 flex-shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 dark:shadow-indigo-950 flex-shrink-0">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Keyboard Shortcuts & Hotkeys
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Speed up navigation, editing, and exploration on the tree canvas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1">
          {renderSection('Navigation & Viewport', navigationShortcuts)}
          {renderSection('Panels & Interactive Tools', toolsShortcuts)}
          {renderSection('Editing & Kinship Management', editingShortcuts)}
        </div>
      </div>
    </div>
  );
};
