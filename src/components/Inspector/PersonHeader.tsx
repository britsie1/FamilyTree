import React, { useRef, useState } from 'react';
import type { Person, TreeData } from '../../types/tree';
import { getPersonDisplayName, getPersonFullName } from '../../services/treeOperations';
import {
  getDirectImageUrl,
  readImageFileAsDataUrl,
  uploadFileToDrive,
  requestDriveAccessToken,
} from '../../services/googleDriveService';
import { useAuth } from '../../hooks/useAuth';
import { useTreeStore } from '../../stores/useTreeStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { useModalStore } from '../../stores/useModalStore';
import {
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  Target,
  Baby,
  Eye,
  Camera,
  Loader2,
  Compass,
  Crosshair,
} from 'lucide-react';

export interface PersonHeaderProps {
  person: Person;
  tree?: TreeData;
  isMobileMinimized: boolean;
  onToggleMobileMinimized: () => void;
  isReadOnly?: boolean;
  isFocused?: boolean;
  onToggleFocus?: (personId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (personId: string) => void;
  onClose?: () => void;
  onDeletePerson?: (personId: string) => void;
  onAddChild?: (personId: string) => void;
  onUpdatePerson?: (personId: string, updates: Partial<Person>) => void;
}

export const PersonHeader: React.FC<PersonHeaderProps> = ({
  person,
  tree: propTree,
  isMobileMinimized,
  onToggleMobileMinimized,
  isReadOnly: propIsReadOnly,
  isFocused: propIsFocused,
  onToggleFocus,
  isCollapsed: propIsCollapsed,
  onToggleCollapse,
  onClose,
  onDeletePerson,
  onAddChild,
  onUpdatePerson,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Store access
  const storeTree = useTreeStore((s) => s.tree);
  const storeUpdatePerson = useTreeStore((s) => s.updatePerson);
  const storeDeletePerson = useTreeStore((s) => s.deletePerson);

  const storeFocusPersonId = useCanvasStore((s) => s.focusPersonId);
  const storeCollapsedPersonIds = useCanvasStore((s) => s.collapsedPersonIds);
  const storeToggleFocus = useCanvasStore((s) => s.toggleFocus);
  const storeToggleCollapse = useCanvasStore((s) => s.toggleCollapse);
  const storeClearSelection = useCanvasStore((s) => s.clearSelection);

  const storeUserPermission = useCollabStore((s) => s.userPermission);
  const openSunburstModal = useModalStore((s) => s.openSunburstModal);

  const tree = propTree || storeTree;
  const isReadOnly = propIsReadOnly !== undefined ? propIsReadOnly : storeUserPermission === 'viewer';
  const isFocused = propIsFocused !== undefined ? propIsFocused : storeFocusPersonId === person.id;
  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : storeCollapsedPersonIds.has(person.id);

  const handleUpdate = onUpdatePerson || storeUpdatePerson;
  const handleDelete = onDeletePerson || storeDeletePerson;
  const handleToggleFocus = onToggleFocus || storeToggleFocus;
  const handleToggleCollapse = onToggleCollapse || storeToggleCollapse;
  const handleClose = onClose || storeClearSelection;

  const displayName = getPersonDisplayName(person);
  const fullName = getPersonFullName(person);

  // Check if person has children
  const hasChildren = person.unionIds.some((uId) => {
    const union = tree.unions[uId];
    return union && union.childrenIds && union.childrenIds.length > 0;
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      if (tree.googleDriveConfig?.folderId) {
        const token = await requestDriveAccessToken();
        const newDoc = await uploadFileToDrive(
          file,
          tree.googleDriveConfig.folderId,
          token,
          {
            description: `Photo for ${displayName}`,
            user: user
              ? {
                  uid: user.uid,
                  name: user.displayName || undefined,
                  email: user.email || undefined,
                }
              : undefined,
          }
        );
        const currentDocs = person.documents || [];
        const photoUrl =
          newDoc.webViewLink ||
          (newDoc.driveFileId ? `https://drive.google.com/file/d/${newDoc.driveFileId}/view` : '');
        handleUpdate(person.id, {
          avatarUrl: photoUrl,
          documents: [...currentDocs, newDoc],
        });
      } else {
        const dataUrl = await readImageFileAsDataUrl(file);
        handleUpdate(person.id, { avatarUrl: dataUrl });
      }
    } catch (err) {
      console.error('Failed to upload avatar from header:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      {/* Mobile drag handle */}
      <div
        className="sm:hidden flex flex-col items-center pt-2.5 pb-1 cursor-pointer select-none"
        onClick={onToggleMobileMinimized}
        title={isMobileMinimized ? 'Expand full inspector' : 'Minimize inspector'}
      >
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full hover:bg-slate-400 dark:hover:bg-slate-600 transition-colors" />
      </div>

      {/* Hidden file input for avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarUpload}
        className="hidden"
      />

      {isMobileMinimized ? (
        /* Mobile Minimized Peek Bar (< sm) */
        <div className="sm:hidden flex items-center justify-between px-4 py-2 bg-slate-50/80 dark:bg-slate-850/80">
          <div
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
            onClick={onToggleMobileMinimized}
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden">
              {person.avatarUrl ? (
                <img
                  src={getDirectImageUrl(person.avatarUrl)}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                ((person.knownAs?.trim() || person.firstName)?.[0] || '') + (person.lastName?.[0] || '') || '?'
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 dark:text-white text-xs truncate">{displayName}</h3>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-0.5">
                <span>Tap to view / edit details</span>
                <ChevronUp className="w-3 h-3" />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isReadOnly && onAddChild && (
              <button
                onClick={() => onAddChild(person.id)}
                className="p-2 bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
                title="Add Child"
              >
                <Baby className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onToggleMobileMinimized}
              className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
              title="Expand inspector"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Avatar with Upload Trigger */}
              <div
                onClick={() => !isReadOnly && !isUploading && fileInputRef.current?.click()}
                className={`relative group w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden ${
                  !isReadOnly ? 'cursor-pointer' : ''
                }`}
                title={!isReadOnly ? 'Click to change avatar photo' : undefined}
              >
                {person.avatarUrl ? (
                  <img
                    src={getDirectImageUrl(person.avatarUrl)}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  ((person.knownAs?.trim() || person.firstName)?.[0] || '') + (person.lastName?.[0] || '') || '?'
                )}
                {!isReadOnly && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <h3
                  className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base leading-tight truncate max-w-[170px] sm:max-w-[180px]"
                  title={fullName}
                >
                  {displayName}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                  <span className="font-mono">ID: {person.id}</span>
                  {person.knownAs?.trim() && (person.firstName || person.middleNames) && (
                    <span className="truncate max-w-[100px]" title={`Full legal name: ${fullName}`}>
                      • {person.firstName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => useCanvasStore.getState().centerOnPerson(person.id)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                title="Locate & Center on Canvas"
                aria-label="Locate on canvas"
              >
                <Crosshair className="w-4 h-4" />
              </button>

              {/* Mobile minimize button */}
              <button
                onClick={onToggleMobileMinimized}
                className="sm:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Minimize inspector"
              >
                <ChevronDown className="w-5 h-5" />
              </button>

              {!isReadOnly && (
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to remove ${displayName} from the tree?`)) {
                      handleDelete(person.id);
                      handleClose();
                    }
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  title="Delete person"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Close inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Read-Only Notice */}
          {isReadOnly && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-850 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-1.5 font-medium">
              <Eye className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>Viewing relative in read-only mode</span>
            </div>
          )}

          {/* Focus & Branch Control Bar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 text-xs">
            <button
              onClick={() => handleToggleFocus(person.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg font-medium transition-all cursor-pointer ${
                isFocused
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
              title={isFocused ? 'Exit focus mode' : 'Isolate this person and their direct lineage on the canvas'}
            >
              <Target className="w-3.5 h-3.5" />
              <span>{isFocused ? 'Focused Branch' : 'Focus Branch'}</span>
            </button>

            <button
              onClick={() => openSunburstModal(person.id)}
              className="flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-lg font-medium border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer shadow-2xs"
              title="Generate Ancestor Sunburst / Fan chart"
            >
              <Compass className="w-3.5 h-3.5 text-indigo-500" />
              <span>Sunburst</span>
            </button>

            {hasChildren && (
              <button
                onClick={() => handleToggleCollapse(person.id)}
                className={`flex items-center justify-center gap-1 py-1 px-2.5 rounded-lg font-medium border transition-all ${
                  isCollapsed
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-500 text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400'
                }`}
                title={isCollapsed ? 'Expand descendants branch' : 'Collapse descendants branch'}
              >
                {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
};
