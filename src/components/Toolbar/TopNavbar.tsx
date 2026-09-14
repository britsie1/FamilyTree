import React, { useState, useRef } from 'react';
import type { TreeData, UserPermission } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import { useAuth } from '../../contexts/AuthContext';
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
} from 'lucide-react';

interface TopNavbarProps {
  tree: TreeData;
  onUpdateTreeName: (name: string) => void;
  onSelectPreset: (presetKey: 'double_in_law' | 'divorce' | 'royal' | 'blank') => void;
  onOpenTreeManager?: () => void;
  onOpenShareModal?: () => void;
  isReadOnly?: boolean;
  isCloudTree?: boolean;
  userPermission?: UserPermission;
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(tree.name);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
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
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-2 sm:px-4 flex items-center justify-between z-40 relative select-none gap-1 sm:gap-2">
      {/* Left: Brand & Tree Name */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
        <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-100 flex-shrink-0">
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
              className="text-sm sm:text-base font-bold text-slate-800 border-b-2 border-indigo-600 focus:outline-none px-1 py-0.5 w-32 sm:w-48"
            />
          ) : (
            <h1
              onClick={() => !isReadOnly && setIsEditingTitle(true)}
              className={`text-xs sm:text-sm md:text-base font-bold text-slate-900 transition-colors flex items-center gap-1 sm:gap-1.5 leading-tight ${
                isReadOnly ? 'cursor-default' : 'cursor-pointer hover:text-indigo-600'
              }`}
              title={isReadOnly ? 'View only tree' : 'Click to rename tree'}
            >
              <span className="truncate max-w-[90px] xs:max-w-[130px] sm:max-w-[180px] md:max-w-xs">{tree.name || 'Untitled Tree'}</span>
              <span className="hidden xs:inline text-[10px] sm:text-[11px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
              </span>
              {isReadOnly && (
                <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                  <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600" />
                  View Only
                </span>
              )}
            </h1>
          )}

          <p className="text-[10px] sm:text-[11px] text-slate-400 hidden md:flex items-center gap-1.5 leading-none mt-1">
            <span>{unionCount} {unionCount === 1 ? 'family union' : 'family unions'}</span>
            <span>•</span>
            {isCloudTree ? (
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                <Cloud className="w-3 h-3" />
                {userPermission === 'owner' ? 'Cloud (Owner)' : userPermission === 'editor' ? 'Cloud (Editor)' : 'Cloud (View Only)'}
              </span>
            ) : (
              <span>Local storage (Offline)</span>
            )}
            <span>•</span>
            <span>Auto-saved</span>
          </p>
        </div>

        {onOpenTreeManager && (
          <button
            onClick={onOpenTreeManager}
            className="flex items-center gap-1 sm:gap-1.5 bg-slate-100 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-slate-700 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-medium border border-slate-200 transition-all shadow-2xs flex-shrink-0 cursor-pointer"
            title="Manage Family Trees (Switch, create, duplicate, or delete)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
            <span className="hidden sm:inline">Trees</span>
          </button>
        )}
      </div>

      {/* Center: Search & Preset templates */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Preset Selector */}
        <div className="relative hidden xl:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs">
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
          <div className="flex items-center bg-slate-100/90 rounded-xl px-2 sm:px-2.5 py-1.5 border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white transition-all w-24 xs:w-32 sm:w-40 md:w-48 focus-within:w-40 xs:focus-within:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5 sm:mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Find..."
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
            <div className="absolute top-full mt-1.5 left-0 sm:left-auto sm:right-0 md:left-0 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-1 z-50 max-h-60 overflow-y-auto">
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
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
        {/* Undo / Redo buttons */}
        <div className="hidden xs:flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1 sm:p-1.5 rounded-lg text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1 sm:p-1.5 rounded-lg text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
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
          className="p-1.5 sm:p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
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
            className="flex items-center gap-0.5 sm:gap-1 p-1.5 sm:p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 text-xs font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
          </button>

          {isExportOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-1 z-50 animate-in fade-in duration-100">
              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportGedcom();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-left transition-colors cursor-pointer"
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
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-left transition-colors cursor-pointer"
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
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-left transition-colors cursor-pointer"
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
          className="hidden md:flex p-1.5 sm:p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors border border-indigo-100 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        <div className="h-5 w-px bg-slate-200 mx-0.5 hidden xs:block" />

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
              className="flex items-center gap-1 p-0.5 sm:p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer border border-slate-200"
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
              <div className="absolute top-full right-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in duration-100">
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {user.displayName || 'Google User'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>

                <div className="py-2 text-xs space-y-1">
                  <div className="flex items-center gap-2 px-2 py-1 text-slate-600">
                    <Cloud className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[11px]">Firebase Cloud Connected</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      signOutUser();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer"
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
            className="flex items-center gap-1 sm:gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold px-2 sm:px-2.5 py-1.5 rounded-xl text-xs shadow-2xs hover:shadow transition-all cursor-pointer"
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
    </header>
  );
};
