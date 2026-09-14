import React, { useState, useRef } from 'react';
import type { TreeData, LayoutStyle } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import {
  GitBranch,
  Download,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Search,
  Plus,
  HelpCircle,
  FolderOpen,
  ArrowDown,
  ArrowRight,
  Users,
  Undo2,
  Redo2,
  FileText,
  ChevronDown,
  SlidersHorizontal,
  Clock,
} from 'lucide-react';

interface TopNavbarProps {
  tree: TreeData;
  layoutStyle: LayoutStyle;
  onToggleLayoutStyle: () => void;
  groupByFamily?: boolean;
  onToggleGroupByFamily?: () => void;
  adjustSpacing?: boolean;
  onToggleAdjustSpacing?: () => void;
  onUpdateTreeName: (name: string) => void;
  onSelectPreset: (presetKey: 'double_in_law' | 'divorce' | 'royal' | 'blank') => void;
  onOpenTreeManager?: () => void;
  onAddPerson: () => void;
  onExportJson: () => void;
  onExportGedcom: () => void;
  onImportFile: (file: File) => void;
  onExportImage: () => void;
  onResetLayout: () => void;
  onSelectPerson: (personId: string) => void;
  onOpenEdgeCaseModal: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isTimelineActive?: boolean;
  onToggleTimeline?: () => void;
  temporalYear?: number | null;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  tree,
  layoutStyle,
  onToggleLayoutStyle,
  groupByFamily = false,
  onToggleGroupByFamily,
  adjustSpacing = true,
  onToggleAdjustSpacing,
  onUpdateTreeName,
  onSelectPreset,
  onOpenTreeManager,
  onAddPerson,
  onExportJson,
  onExportGedcom,
  onImportFile,
  onExportImage,
  onResetLayout,
  onSelectPerson,
  onOpenEdgeCaseModal,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isTimelineActive = false,
  onToggleTimeline,
  temporalYear,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(tree.name);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prevTreeName, setPrevTreeName] = useState(tree.name);
  if (tree.name !== prevTreeName) {
    setPrevTreeName(tree.name);
    setTitleInput(tree.name);
  }

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onUpdateTreeName(titleInput.trim());
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
    // Reset file input value so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Search filter
  const searchResults = Object.values(tree.people).filter((p) => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.toLowerCase();
    const nameString = `${p.firstName || ''} ${p.middleNames || ''} ${p.knownAs || ''} ${p.lastName || ''} ${p.maidenName || ''}`.toLowerCase();
    return nameString.includes(query) || (p.notes && p.notes.toLowerCase().includes(query)) || p.id.toLowerCase().includes(query);
  });

  const peopleCount = Object.keys(tree.people).length;
  const unionCount = Object.keys(tree.unions).length;

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between z-40 relative select-none">
      {/* Left: Brand & Tree Name */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-100 flex-shrink-0">
          <GitBranch className="w-5 h-5" />
        </div>

        <div>
          {isEditingTitle ? (
            <input
              type="text"
              autoFocus
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') {
                  setTitleInput(tree.name);
                  setIsEditingTitle(false);
                }
              }}
              className="text-base font-bold text-slate-800 border-b-2 border-indigo-600 focus:outline-none px-1 py-0.5"
            />
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="text-base font-bold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors flex items-center gap-1.5 leading-tight"
              title="Click to rename tree"
            >
              <span>{tree.name || 'Untitled Tree'}</span>
              <span className="text-[11px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
              </span>
            </h1>
          )}

          <p className="text-[11px] text-slate-400 hidden sm:block leading-none mt-1">
            {unionCount} {unionCount === 1 ? 'family union' : 'family unions'} • Auto-saved
          </p>
        </div>

        {onOpenTreeManager && (
          <button
            onClick={onOpenTreeManager}
            className="hidden sm:flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-slate-200 transition-all ml-1 shadow-2xs"
            title="Manage Family Trees (Switch, create, duplicate, or delete)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
            <span>Trees</span>
          </button>
        )}
      </div>

      {/* Center: Search & Preset templates */}
      <div className="flex items-center gap-2">
        {/* Preset Selector */}
        <div className="relative hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs">
          <FolderOpen className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          <select
            onChange={(e) => onSelectPreset(e.target.value as any)}
            defaultValue=""
            className="bg-transparent border-none text-slate-700 text-xs font-medium focus:outline-none cursor-pointer py-1 pr-2"
          >
            <option value="" disabled>
              Load Preset Example...
            </option>
            <option value="double_in_law">⚡ Double In-Law (Brothers & Sisters)</option>
            <option value="divorce">💔 Divorce & Remarriage (Blended Family)</option>
            <option value="royal">👑 Multi-Generational Royal Family</option>
            <option value="blank">✨ Blank Tree (Start from scratch)</option>
          </select>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="flex items-center bg-slate-100/90 rounded-xl px-2.5 py-1.5 border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white transition-all w-36 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Find person..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
            />
          </div>

          {/* Search Results Dropdown */}
          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute top-full mt-1.5 left-0 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-1 z-50 max-h-60 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-3 text-xs text-slate-400 text-center">No relatives found</div>
              ) : (
                searchResults.map((p) => {
                  const displayName = getPersonDisplayName(p);
                  const initials = ((p.knownAs?.trim() || p.firstName)?.[0] || '') + (p.lastName?.[0] || '') || '?';
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelectPerson(p.id);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center gap-2 p-2 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">
                          {displayName}
                        </p>
                        {p.knownAs?.trim() && p.firstName && (
                          <p className="text-[10px] text-slate-400 truncate">
                            Legal: {[p.firstName, p.middleNames, p.lastName].filter(Boolean).join(' ')}
                          </p>
                        )}
                        {p.notes && !p.knownAs?.trim() && (
                          <p className="text-[10px] text-slate-400 truncate">{p.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo buttons */}
        <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Add Person */}
        <button
          onClick={onAddPerson}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3 py-1.5 rounded-xl font-medium text-xs shadow-sm hover:shadow transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Person</span>
        </button>

        {/* Toggle Layout Style Button */}
        <button
          onClick={onToggleLayoutStyle}
          title={
            layoutStyle === 'horizontal'
              ? 'Currently in Left-to-Right layout. Click to toggle back to Top-Down (original).'
              : 'Currently in Top-Down layout. Click to toggle to Left-to-Right (pedigree).'
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs border transition-all ${
            layoutStyle === 'horizontal'
              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-300 shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
          }`}
        >
          {layoutStyle === 'horizontal' ? (
            <>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
              <span>Left-to-Right</span>
            </>
          ) : (
            <>
              <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
              <span>Top-Down</span>
            </>
          )}
        </button>

        {/* 4D Temporal Timeline Scrub Button */}
        {onToggleTimeline && (
          <button
            onClick={onToggleTimeline}
            title={
              isTimelineActive
                ? `4D Timeline is Active (Year ${temporalYear}). Click to exit temporal view.`
                : 'Launch 4D Temporal Scrub Bar ("Who Was in the Room?").'
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs border transition-all ${
              isTimelineActive
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 font-bold shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${isTimelineActive ? 'text-slate-950 animate-pulse' : 'text-amber-600'}`} />
            <span>4D Timeline</span>
            {isTimelineActive && temporalYear && (
              <span className="font-mono text-[10px] bg-slate-950/20 px-1.5 py-0.2 rounded">
                {temporalYear}
              </span>
            )}
          </button>
        )}

        {/* Toggle Group Families Button */}
        {onToggleGroupByFamily && (
          <button
            onClick={onToggleGroupByFamily}
            title={
              groupByFamily
                ? 'Group Families is ON. Click to disable family separation gap.'
                : "Click to visually group and space apart family branches (e.g. your family and your wife's family)."
            }
            className={`hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs border transition-all ${
              groupByFamily
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
          >
            <Users className={`w-3.5 h-3.5 ${groupByFamily ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>Group Families</span>
            {groupByFamily && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </button>
        )}

        {/* Toggle Adjust Spacing Button */}
        {onToggleAdjustSpacing && (
          <button
            onClick={onToggleAdjustSpacing}
            title={
              adjustSpacing
                ? 'Adjust Spacing is ON (grouped by widest row upwards & downwards). Click to switch to uniform equidistant spacing.'
                : 'Click to adjust tree spacing based on the widest row upwards and downwards, bringing parents and children closer together.'
            }
            className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs border transition-all ${
              adjustSpacing
                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-300 shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
          >
            <SlidersHorizontal className={`w-3.5 h-3.5 ${adjustSpacing ? 'text-indigo-600' : 'text-slate-500'}`} />
            <span>Adjust Spacing</span>
            {adjustSpacing && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </button>
        )}

        {/* Auto-Tidy / Reset Layout */}
        <button
          onClick={onResetLayout}
          title="Auto-organize nodes into optimal generational layout"
          className="hidden md:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-medium text-xs border border-slate-200 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Auto-Tidy</span>
        </button>

        {/* Import JSON or GEDCOM */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Import family tree (.ged GEDCOM or .json file)"
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
        >
          <Upload className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.ged"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Export Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setIsExportOpen((prev) => !prev)}
            title="Export tree (GEDCOM, JSON, or Image)"
            className="flex items-center gap-1 p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 text-xs font-medium"
          >
            <Download className="w-4 h-4" />
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isExportOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-1 z-50 animate-in fade-in duration-100">
              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportGedcom();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-left transition-colors"
              >
                <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">Export GEDCOM (.ged)</p>
                  <p className="text-[10px] text-slate-400">Ancestry, Gramps, MyHeritage</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportJson();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-left transition-colors"
              >
                <Download className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">Export JSON (.json)</p>
                  <p className="text-[10px] text-slate-400">Layout & manual coordinates</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportImage();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-left transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">Export PNG Image</p>
                  <p className="text-[10px] text-slate-400">High-resolution snapshot</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Edge Case & Help info modal */}
        <button
          onClick={onOpenEdgeCaseModal}
          title="How edge cases (like double in-law marriages) and bridge hops are handled"
          className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors border border-indigo-100"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
