import React, { useRef, useState } from 'react';
import type { Person, Gender, TreeData } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import {
  getDirectImageUrl,
  readImageFileAsDataUrl,
  uploadFileToDrive,
  requestDriveAccessToken,
} from '../../services/googleDriveService';
import { useAuth } from '../../hooks/useAuth';
import { useTreeStore } from '../../stores/useTreeStore';
import { useCollabStore } from '../../stores/useCollabStore';
import {
  Upload,
  ExternalLink,
  Camera,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react';

export interface PersonBioSectionProps {
  person: Person;
  tree?: TreeData;
  isReadOnly?: boolean;
  onUpdatePerson?: (personId: string, updates: Partial<Person>) => void;
}

export const PersonBioSection: React.FC<PersonBioSectionProps> = ({
  person,
  tree: propTree,
  isReadOnly: propIsReadOnly,
  onUpdatePerson,
}) => {
  const { user } = useAuth();
  const photoFileInputRef = useRef<HTMLInputElement>(null);

  const [photoInputMode, setPhotoInputMode] = useState<'upload' | 'url'>('upload');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Store access
  const storeTree = useTreeStore((s) => s.tree);
  const storeUpdatePerson = useTreeStore((s) => s.updatePerson);
  const storeUserPermission = useCollabStore((s) => s.userPermission);

  const tree = propTree || storeTree;
  const isReadOnly = propIsReadOnly !== undefined ? propIsReadOnly : storeUserPermission === 'viewer';
  const handleUpdate = onUpdatePerson || storeUpdatePerson;

  const displayName = getPersonDisplayName(person);

  const handlePhotoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    setPhotoError(null);

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
    } catch (err: any) {
      console.error('Failed to upload photo:', err);
      setPhotoError(err.message || 'Failed to upload photo.');
    } finally {
      setIsUploadingPhoto(false);
      if (photoFileInputRef.current) {
        photoFileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    handleUpdate(person.id, { avatarUrl: undefined });
  };

  return (
    <div className="space-y-4">
      {/* Identity Title */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Identity</h4>

        {/* First Name & Middle Names */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">First Name</label>
            <input
              type="text"
              value={person.firstName || ''}
              onChange={(e) => handleUpdate(person.id, { firstName: e.target.value })}
              placeholder="Optional"
              disabled={isReadOnly}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Middle Names</label>
            <input
              type="text"
              value={person.middleNames || ''}
              onChange={(e) => handleUpdate(person.id, { middleNames: e.target.value })}
              placeholder="e.g. Alexander"
              disabled={isReadOnly}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Last Name & Maiden / Birth Name */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Last Name</label>
            <input
              type="text"
              value={person.lastName || ''}
              onChange={(e) => handleUpdate(person.id, { lastName: e.target.value })}
              placeholder="Optional"
              disabled={isReadOnly}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Maiden / Birth Name
            </label>
            <input
              type="text"
              value={person.maidenName || ''}
              onChange={(e) => handleUpdate(person.id, { maidenName: e.target.value })}
              placeholder="e.g. Miller (optional)"
              disabled={isReadOnly}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Known As */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Known As</label>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">
              Used on Tree
            </span>
          </div>
          <input
            type="text"
            value={person.knownAs || ''}
            onChange={(e) => handleUpdate(person.id, { knownAs: e.target.value })}
            placeholder="e.g. Bob (displayed on tree instead of first name)"
            disabled={isReadOnly}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            When specified, this name is displayed with the surname on the family tree instead of the first name.
          </p>
        </div>

        {/* Gender */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Gender</label>
          <div className="grid grid-cols-4 gap-1">
            {(['male', 'female', 'other', 'unspecified'] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                disabled={isReadOnly}
                onClick={() => handleUpdate(person.id, { gender: g })}
                className={`py-1 text-xs rounded capitalize border transition-all disabled:opacity-50 ${
                  (person.gender || 'unspecified') === g
                    ? 'bg-indigo-600 text-white border-indigo-600 font-medium shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Photo / Portrait (Dual-Mode: Upload or URL Link) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Photo / Portrait
            </label>
            {person.avatarUrl && !isReadOnly && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                title="Remove current photo"
              >
                <Trash2 className="w-3 h-3" /> Remove photo
              </button>
            )}
          </div>

          {/* Current Portrait Preview */}
          {person.avatarUrl && (
            <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center">
                <img
                  src={getDirectImageUrl(person.avatarUrl)}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  Current Portrait
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {person.avatarUrl.startsWith('data:')
                    ? 'Uploaded image (embedded)'
                    : person.avatarUrl.includes('drive.google.com')
                    ? 'Google Drive file'
                    : person.avatarUrl}
                </p>
              </div>
            </div>
          )}

          {/* Dual-Mode Controls for Editors */}
          {!isReadOnly && (
            <div className="space-y-2">
              {/* Mode Selector */}
              <div className="flex items-center gap-1.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setPhotoInputMode('upload')}
                  className={`flex-1 py-1 px-2.5 rounded-md font-medium text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    photoInputMode === 'upload'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3 h-3" />
                  Upload Photo
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoInputMode('url')}
                  className={`flex-1 py-1 px-2.5 rounded-md font-medium text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    photoInputMode === 'url'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <ExternalLink className="w-3 h-3" />
                  Photo URL Link
                </button>
              </div>

              {/* Mode: Upload */}
              {photoInputMode === 'upload' && (
                <div className="space-y-2">
                  <input
                    ref={photoFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingPhoto}
                    onClick={() => photoFileInputRef.current?.click()}
                    className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingPhoto ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading photo...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" />
                        <span>
                          {person.avatarUrl ? 'Choose New Photo...' : 'Choose Photo to Upload...'}
                        </span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {tree.googleDriveConfig?.folderId
                      ? 'Photo will be stored in your linked Google Drive folder and attached to records.'
                      : 'Drive not linked. Photo will be saved directly into tree data.'}
                  </p>
                </div>
              )}

              {/* Mode: URL Link */}
              {photoInputMode === 'url' && (
                <div className="space-y-1">
                  <input
                    type="url"
                    value={person.avatarUrl || ''}
                    onChange={(e) => handleUpdate(person.id, { avatarUrl: e.target.value })}
                    placeholder="https://... or Google Drive image link"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Direct image URL or Google Drive share link (automatically converted for card display).
                  </p>
                </div>
              )}

              {photoError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{photoError}</span>
                </div>
              )}
            </div>
          )}

          {/* Read-only view */}
          {isReadOnly && person.avatarUrl && (
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              {person.avatarUrl}
            </div>
          )}
        </div>
      </div>

      {/* Notes & Biography */}
      <div className="pt-1">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
          Notes & Biography
        </label>
        <textarea
          rows={3}
          value={person.notes || ''}
          onChange={(e) => handleUpdate(person.id, { notes: e.target.value })}
          placeholder="Add personal anecdotes, historical context, or edge case notes..."
          disabled={isReadOnly}
          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-50"
        />
      </div>
    </div>
  );
};
