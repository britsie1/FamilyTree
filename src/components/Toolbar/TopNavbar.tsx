import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { TreeData, UserPermission } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import { useAuth } from '../../hooks/useAuth';
import {
  GitBranch,
  Download,
  Upload,
  Image as ImageIcon,
  Search,
  Plus,
  HelpCircle,
  FolderOpen,
  Undo2,
  Redo2,
  FileText,
  ChevronDown,
  Share2,
  Cloud,
  Eye,
  Copy,
  LogOut,
  Check,
  AlertCircle,
  Loader2,
  LogIn,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';

interface TopNavbarProps {
  tree: TreeData;
  onUpdateTreeName: (name: string) => void;
  onSelectPreset: (presetKey: 'double_in_law' | 'divorce' | 'royal' | 'blank') => void;
  onOpenTreeManager?: () => void;
  onOpenShareModal?: () => void;
  isReadOnly?: boolean;
  isCloudTree?: boolean;
  userPermission?: UserPermission;
  cloudSyncStatus?: 'synced' | 'saving' | 'error' | 'offline';
  cloudSyncError?: string | null;
  onMakeCopy?: () => void;
  onAddPerson: () => void;
  onExportJson: () => void;
  onExportGedcom: () => void;
  onImportFile: (file: File) => void;
  onExportImage: () => void;
  onSelectPerson: (personId: string) => void;
  onOpenEdgeCaseModal: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  tree,
  onUpdateTreeName,
  onSelectPreset,
  onOpenTreeManager,
  onOpenShareModal,
  isReadOnly = false,
  isCloudTree = false,
  userPermission = 'owner',
  cloudSyncStatus = 'synced',
  cloudSyncError = null,
  onMakeCopy,
  onAddPerson,
  onExportJson,
  onExportGedcom,
  onImportFile,
  onExportImage,
  onSelectPerson,
  onOpenEdgeCaseModal,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) => {
  const { user, isConfigured, signInWithGoogle, signOutUser } = useAuth();
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(tree.name);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle mobile menu close on Escape key and lock body scroll
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

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
    <header className="h-14 sm:h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-2.5 sm:px-4 flex items-center justify-between z-40 relative select-none gap-1 sm:gap-2 text-slate-900 dark:text-slate-100">
      {/* Mobile Full-Width Search Overlay */}
      {isMobileSearchOpen && (
        <div className="absolute inset-0 bg-white dark:bg-slate-900 z-50 px-3 flex items-center gap-2 animate-in fade-in duration-150 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search relative by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none py-1.5"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              setIsMobileSearchOpen(false);
              setSearchQuery('');
            }}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
          >
            Cancel
          </button>

          {/* Mobile Search Results Dropdown */}
          {searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl max-h-[60vh] overflow-y-auto p-2 z-50">
              {searchResults.length === 0 ? (
                <div className="p-4 text-xs text-slate-400 dark:text-slate-500 text-center">No relatives found</div>
              ) : (
                searchResults.map((p) => {
                  const displayName = getPersonDisplayName(p);
                  const initials = ((p.knownAs?.trim() || p.firstName)?.[0] || '') + (p.lastName?.[0] || '') || '?';
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelectPerson(p.id);
                        setIsMobileSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center gap-3 p-2.5 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors active:bg-indigo-100 dark:active:bg-slate-750"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{displayName}</p>
                        {p.knownAs?.trim() && p.firstName && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                            Legal: {[p.firstName, p.middleNames, p.lastName].filter(Boolean).join(' ')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Left: Brand & Tree Name */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
        <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-100 dark:shadow-indigo-950 flex-shrink-0">
          <GitBranch className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>

        <div className="min-w-0">
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
              className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 border-b-2 border-indigo-600 focus:outline-none px-1 py-0.5 w-28 xs:w-36 sm:w-48 bg-transparent"
            />
          ) : (
            <h1
              onClick={() => !isReadOnly && setIsEditingTitle(true)}
              className={`text-xs sm:text-sm md:text-base font-bold text-slate-900 dark:text-slate-100 transition-colors flex items-center gap-1 sm:gap-1.5 leading-tight ${
                isReadOnly ? 'cursor-default' : 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
              title={isReadOnly ? 'View only tree' : 'Click to rename tree'}
            >
              <span className="truncate max-w-[85px] xs:max-w-[130px] sm:max-w-[180px] md:max-w-xs">{tree.name || 'Untitled Tree'}</span>
              <span className="text-[10px] sm:text-[11px] font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
              </span>
              {isReadOnly && (
                <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 border border-amber-300 dark:border-amber-800">
                  <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600 dark:text-amber-400" />
                  View Only
                </span>
              )}
              {isCloudTree && userPermission === 'editor' && !user && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    signInWithGoogle();
                  }}
                  className="hidden xs:inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 px-1.5 sm:px-2 py-0.5 rounded-full cursor-pointer transition-colors"
                  title="You are editing as a guest. Click to sign in with Google to sync edits."
                >
                  <LogIn className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-600 dark:text-blue-400" />
                  <span>Guest Editor</span>
                </button>
              )}
            </h1>
          )}

          <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 hidden md:flex items-center gap-1.5 leading-none mt-1">
            <span>{unionCount} {unionCount === 1 ? 'family union' : 'family unions'}</span>
            <span>•</span>
            {isCloudTree ? (
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                <Cloud className="w-3 h-3" />
                {userPermission === 'owner' ? 'Cloud (Owner)' : userPermission === 'editor' ? 'Cloud (Editor)' : 'Cloud (View Only)'}
              </span>
            ) : (
              <span>Local storage (Offline)</span>
            )}
            <span>•</span>
            {isCloudTree ? (
              cloudSyncStatus === 'saving' ? (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                  <span>Saving...</span>
                </span>
              ) : cloudSyncStatus === 'error' ? (
                <button
                  type="button"
                  onClick={!user ? () => signInWithGoogle() : undefined}
                  className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer"
                  title={cloudSyncError || 'Sync failed. Click to resolve.'}
                >
                  <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                  <span>{!user ? 'Sync failed (Sign in to sync)' : 'Sync error'}</span>
                </button>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Saved to cloud</span>
                </span>
              )
            ) : (
              <span>Auto-saved</span>
            )}
          </p>
        </div>

        {onOpenTreeManager && (
          <button
            onClick={onOpenTreeManager}
            className="hidden sm:flex items-center gap-1 sm:gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-750 hover:border-indigo-300 dark:hover:border-slate-600 hover:text-indigo-700 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-200 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 transition-all shadow-2xs flex-shrink-0 cursor-pointer"
            title="Manage Family Trees (Switch, create, duplicate, or delete)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <span className="hidden sm:inline">Trees</span>
          </button>
        )}
      </div>

      {/* Mobile-Only Header Action Buttons (< sm) */}
      <div className="flex sm:hidden items-center gap-1 flex-shrink-0">
        <button
          onClick={() => setIsMobileSearchOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 transition-colors cursor-pointer"
          title="Search relative"
          aria-label="Search relatives"
        >
          <Search className="w-4 h-4" />
        </button>

        {isReadOnly ? (
          onMakeCopy && (
            <button
              onClick={onMakeCopy}
              className="w-9 h-9 flex items-center justify-center bg-amber-600 active:bg-amber-700 text-white rounded-xl shadow-xs cursor-pointer"
              title="Make a Copy"
              aria-label="Make a Copy"
            >
              <Copy className="w-4 h-4" />
            </button>
          )
        ) : (
          <button
            onClick={onAddPerson}
            className="w-9 h-9 flex items-center justify-center bg-indigo-600 active:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer"
            title="Add Person"
            aria-label="Add Person"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          title="Open Menu"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Center: Search & Preset templates */}
      <div className="hidden sm:flex items-center gap-1.5 sm:gap-2">
        {/* Preset Selector */}
        <div className="relative hidden xl:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <FolderOpen className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ml-1.5" />
          <select
            onChange={(e) => onSelectPreset(e.target.value as any)}
            defaultValue=""
            className="bg-transparent border-none text-slate-700 dark:text-slate-200 text-xs font-medium focus:outline-none cursor-pointer py-1 pr-2"
          >
            <option value="" disabled className="dark:bg-slate-900 dark:text-slate-300">
              Load Preset Example...
            </option>
            <option value="double_in_law" className="dark:bg-slate-900 dark:text-slate-300">⚡ Double In-Law (Brothers & Sisters)</option>
            <option value="divorce" className="dark:bg-slate-900 dark:text-slate-300">💔 Divorce & Remarriage (Blended Family)</option>
            <option value="royal" className="dark:bg-slate-900 dark:text-slate-300">👑 Multi-Generational Royal Family</option>
            <option value="blank" className="dark:bg-slate-900 dark:text-slate-300">✨ Blank Tree (Start from scratch)</option>
          </select>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/90 rounded-xl px-2 sm:px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:bg-white dark:focus-within:bg-slate-850 transition-all w-24 xs:w-32 sm:w-40 md:w-48 focus-within:w-40 xs:focus-within:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mr-1.5 sm:mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Find..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none w-full"
            />
          </div>

          {/* Search Results Dropdown */}
          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute top-full mt-1.5 left-0 sm:left-auto sm:right-0 md:left-0 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-1 z-50 max-h-60 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-3 text-xs text-slate-400 dark:text-slate-500 text-center">No relatives found</div>
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
                      className="flex items-center gap-2 p-2 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">
                          {displayName}
                        </p>
                        {p.knownAs?.trim() && p.firstName && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            Legal: {[p.firstName, p.middleNames, p.lastName].filter(Boolean).join(' ')}
                          </p>
                        )}
                        {p.notes && !p.knownAs?.trim() && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{p.notes}</p>
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

      {/* Right: Desktop Actions */}
      <div className="hidden sm:flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
        {/* Undo / Redo buttons */}
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1 sm:p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1 sm:p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Add Person or Make a Copy */}
        {isReadOnly ? (
          onMakeCopy && (
            <button
              onClick={onMakeCopy}
              className="flex items-center gap-1 sm:gap-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-2.5 sm:px-3 py-1.5 rounded-xl font-medium text-xs shadow-xs hover:shadow transition-all cursor-pointer"
              title="Create your own editable copy of this tree"
            >
              <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Make a Copy</span>
            </button>
          )
        ) : (
          <button
            onClick={onAddPerson}
            className="flex items-center gap-1 sm:gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-2.5 sm:px-3 py-1.5 rounded-xl font-medium text-xs shadow-xs hover:shadow transition-all cursor-pointer"
            title="Add new family member"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Add Person</span>
          </button>
        )}

        {/* Import JSON or GEDCOM */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Import family tree (.ged GEDCOM or .json file)"
          className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
            className="flex items-center gap-0.5 sm:gap-1 p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
          </button>

          {isExportOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-1 z-50 animate-in fade-in duration-100">
              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportGedcom();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300 rounded-lg text-left transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Export GEDCOM (.ged)</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Ancestry, Gramps, MyHeritage</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportJson();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300 rounded-lg text-left transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Export JSON (.json)</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Layout & manual coordinates</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportImage();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300 rounded-lg text-left transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Export PNG Image</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">High-resolution snapshot</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Edge Case & Help info modal */}
        <button
          onClick={onOpenEdgeCaseModal}
          title="How edge cases (like double in-law marriages) and bridge hops are handled"
          className="hidden md:flex p-1.5 sm:p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-colors border border-indigo-100 dark:border-slate-700 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Dark / Light Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
        >
          {isDark ? (
            <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
          )}
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 hidden xs:block" />

        {/* Google Drive-style Share Button */}
        {onOpenShareModal && (
          <button
            onClick={onOpenShareModal}
            title="Share family tree (Public link or closed email list)"
            className="flex items-center gap-1 sm:gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-2.5 sm:px-3.5 py-1.5 rounded-xl font-semibold text-xs shadow-xs hover:shadow transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
        )}

        {/* User Account / Google Sign-In */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              className="flex items-center gap-1 p-0.5 sm:p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              title={user.displayName || user.email || 'User Account'}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 mr-0.5" />
            </button>

            {isProfileMenuOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-in fade-in duration-100">
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {user.displayName || 'Google User'}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>

                <div className="py-2 text-xs space-y-1">
                  <div className="flex items-center gap-2 px-2 py-1 text-slate-600 dark:text-slate-300">
                    <Cloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="text-[11px]">Firebase Cloud Connected</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      signOutUser();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={async () => {
              if (!isConfigured) {
                if (onOpenShareModal) {
                  onOpenShareModal();
                } else {
                  alert(
                    'Firebase environment variables were not detected in this build.\n\nIf you added variables in Netlify, please trigger a redeploy (Deploys > Trigger deploy > Clear cache and deploy site).'
                  );
                }
                return;
              }
              try {
                await signInWithGoogle();
              } catch (err: any) {
                console.error('Sign-in error:', err);
                alert(err.message || 'Sign in failed');
              }
            }}
            className="flex items-center gap-1 sm:gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-semibold px-2 sm:px-2.5 py-1.5 rounded-xl text-xs shadow-2xs hover:shadow transition-all cursor-pointer"
            title="Sign in with Google to enable cloud saving and sharing"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}
      </div>

      {/* Mobile Drawer / Action Sheet (< sm) */}
      {isMobileMenuOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
              className="fixed inset-0"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative bg-white dark:bg-slate-900 w-full rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] max-h-[85dvh] z-10 animate-in slide-in-from-bottom duration-200">
              {/* Drawer Pull Handle & Pinned Header */}
              <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 flex flex-col items-center gap-2">
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
                <div className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      <GitBranch className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {tree.name || 'Untitled Tree'}
                      </h3>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {peopleCount} {peopleCount === 1 ? 'person' : 'people'} • {unionCount} {unionCount === 1 ? 'union' : 'unions'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                    title="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Content Body */}
              <div className="overflow-y-auto overscroll-contain flex-1 p-4 sm:p-5 pt-3 flex flex-col gap-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                {/* Tree Management & Undo/Redo */}
                <div className="grid grid-cols-2 gap-2">
                  {onOpenTreeManager && (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenTreeManager();
                      }}
                      className="col-span-2 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-sm rounded-xl border border-indigo-200 dark:border-indigo-800 cursor-pointer active:scale-98 transition-all"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Switch & Manage Trees</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onUndo?.();
                    }}
                    disabled={!canUndo}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer active:bg-slate-200 dark:active:bg-slate-700 transition-colors"
                  >
                    <Undo2 className="w-4 h-4" />
                    <span>Undo</span>
                  </button>

                  <button
                    onClick={() => {
                      onRedo?.();
                    }}
                    disabled={!canRedo}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer active:bg-slate-200 dark:active:bg-slate-700 transition-colors"
                  >
                    <Redo2 className="w-4 h-4" />
                    <span>Redo</span>
                  </button>
                </div>

                {/* Appearance (Theme Toggle) */}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between py-2.5 px-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer active:scale-98 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      {isDark ? (
                        <Sun className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Moon className="w-4 h-4 text-slate-600" />
                      )}
                      <span>Appearance</span>
                    </div>
                    <span className="text-[11px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full font-bold text-slate-700 dark:text-slate-200">
                      {isDark ? 'Dark Mode' : 'Light Mode'}
                    </span>
                  </button>
                </div>

                {/* Share & Google Auth */}
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Cloud & Collaboration
                  </h4>
                  {onOpenShareModal && (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenShareModal();
                      }}
                      className="w-full flex items-center justify-between py-2.5 px-3.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold text-xs rounded-xl border border-blue-200 dark:border-blue-800 cursor-pointer active:bg-blue-100 dark:active:bg-blue-900/60 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Share2 className="w-4 h-4" />
                        <span>Share Family Tree</span>
                      </div>
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full font-bold">
                        {isCloudTree ? 'Cloud synced' : 'Share link'}
                      </span>
                    </button>
                  )}

                  {user ? (
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                            {(user.displayName || user.email || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-white truncate">{user.displayName || 'Google User'}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          signOutUser();
                        }}
                        className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        setIsMobileMenuOpen(false);
                        if (!isConfigured) {
                          onOpenShareModal?.();
                          return;
                        }
                        try {
                          await signInWithGoogle();
                        } catch (err: any) {
                          alert(err.message || 'Sign in failed');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs cursor-pointer active:bg-slate-50 dark:active:bg-slate-700 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      <span>Sign in with Google</span>
                    </button>
                  )}
                </div>

                {/* Presets & Templates */}
                <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Preset Examples
                  </h4>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onSelectPreset('double_in_law');
                      }}
                      className="p-2 text-left bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-750 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium active:bg-indigo-100 dark:active:bg-slate-700"
                    >
                      ⚡ Double In-Law
                    </button>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onSelectPreset('divorce');
                      }}
                      className="p-2 text-left bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-750 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium active:bg-indigo-100 dark:active:bg-slate-700"
                    >
                      💔 Blended Family
                    </button>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onSelectPreset('royal');
                      }}
                      className="p-2 text-left bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-750 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium active:bg-indigo-100 dark:active:bg-slate-700"
                    >
                      👑 Royal Lineage
                    </button>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onSelectPreset('blank');
                      }}
                      className="p-2 text-left bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-750 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium active:bg-indigo-100 dark:active:bg-slate-700"
                    >
                      ✨ Blank Tree
                    </button>
                  </div>
                </div>

                {/* Export & Import */}
                <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Import & Export
                  </h4>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onExportGedcom();
                      }}
                      className="flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium gap-1 active:bg-slate-200 dark:active:bg-slate-700"
                    >
                      <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-[11px]">GEDCOM</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onExportJson();
                      }}
                      className="flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium gap-1 active:bg-slate-200 dark:active:bg-slate-700"
                    >
                      <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      <span className="text-[11px]">JSON</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onExportImage();
                      }}
                      className="flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium gap-1 active:bg-slate-200 dark:active:bg-slate-700"
                    >
                      <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[11px]">PNG Image</span>
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer active:bg-slate-300 dark:active:bg-slate-600 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import File (.ged / .json)</span>
                  </button>
                </div>

                {/* Help / Guide */}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenEdgeCaseModal();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-medium cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Edge Cases & Guide</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};
