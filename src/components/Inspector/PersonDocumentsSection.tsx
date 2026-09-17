import React, { useState } from 'react';
import type { Person, PersonDocument, TreeData } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import {
  formatFileSize,
  getFileCategory,
  uploadFileToDrive,
  deleteFileFromDrive,
  requestDriveAccessToken,
} from '../../services/googleDriveService';
import { useAuth } from '../../hooks/useAuth';
import { useTreeStore } from '../../stores/useTreeStore';
import { useCollabStore } from '../../stores/useCollabStore';
import {
  HardDrive,
  Plus,
  Folder,
  ExternalLink,
  Upload,
  X,
  AlertCircle,
  Loader2,
  Trash2,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Music,
  Video,
  File,
} from 'lucide-react';

export interface PersonDocumentsSectionProps {
  person: Person;
  tree?: TreeData;
  isReadOnly?: boolean;
  onUpdatePerson?: (personId: string, updates: Partial<Person>) => void;
  onOpenShareModal?: () => void;
  onPreviewDocument?: (doc: PersonDocument, personName: string) => void;
}

type CategoryTab = 'all' | 'vital' | 'photos' | 'documents';

export const PersonDocumentsSection: React.FC<PersonDocumentsSectionProps> = ({
  person,
  tree: propTree,
  isReadOnly: propIsReadOnly,
  onUpdatePerson,
  onOpenShareModal,
  onPreviewDocument,
}) => {
  const { user } = useAuth();
  const [isAttachingDoc, setIsAttachingDoc] = useState(false);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [docDescription, setDocDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('all');

  // Store access
  const storeTree = useTreeStore((s) => s.tree);
  const storeUpdatePerson = useTreeStore((s) => s.updatePerson);
  const storeIsShareModalOpen = useCollabStore((s) => s.setIsShareModalOpen);
  const storeUserPermission = useCollabStore((s) => s.userPermission);

  const tree = propTree || storeTree;
  const isReadOnly = propIsReadOnly !== undefined ? propIsReadOnly : storeUserPermission === 'viewer';
  const handleUpdate = onUpdatePerson || storeUpdatePerson;
  const handleOpenShareModal = onOpenShareModal || (() => storeIsShareModalOpen(true));

  const displayName = getPersonDisplayName(person);
  const documents = person.documents || [];

  const renderDocIcon = (doc: PersonDocument) => {
    const cat = getFileCategory(doc.fileType, doc.name);
    switch (cat) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-emerald-500" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-rose-500" />;
      case 'spreadsheet':
        return <FileSpreadsheet className="w-4 h-4 text-teal-500" />;
      case 'archive':
        return <FileArchive className="w-4 h-4 text-amber-500" />;
      case 'audio':
        return <Music className="w-4 h-4 text-purple-500" />;
      case 'video':
        return <Video className="w-4 h-4 text-indigo-500" />;
      case 'document':
        return <FileText className="w-4 h-4 text-blue-500" />;
      default:
        return <File className="w-4 h-4 text-slate-500" />;
    }
  };

  const isDocInCategory = (doc: PersonDocument, category: CategoryTab): boolean => {
    if (category === 'all') return true;
    const cat = getFileCategory(doc.fileType, doc.name);
    if (category === 'photos') {
      return cat === 'image' || cat === 'audio' || cat === 'video';
    }
    if (category === 'vital') {
      return cat === 'pdf' || cat === 'document';
    }
    if (category === 'documents') {
      return cat === 'spreadsheet' || cat === 'archive' || cat === 'other' || cat === 'document';
    }
    return true;
  };

  const filteredDocuments = documents.filter((doc) => isDocInCategory(doc, activeCategory));

  const countForCategory = (cat: CategoryTab) => {
    if (cat === 'all') return documents.length;
    return documents.filter((d) => isDocInCategory(d, cat)).length;
  };

  const handleUploadDocument = async () => {
    if (!selectedFile || !tree.googleDriveConfig?.folderId) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const token = await requestDriveAccessToken();
      const newDoc = await uploadFileToDrive(
        selectedFile,
        tree.googleDriveConfig.folderId,
        token,
        {
          description: docDescription.trim(),
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
      handleUpdate(person.id, { documents: [...currentDocs, newDoc] });
      setIsAttachingDoc(false);
      setSelectedFile(null);
      setDocDescription('');
    } catch (err: any) {
      console.error('Failed to upload document to Google Drive:', err);
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docToDelete: PersonDocument) => {
    if (!window.confirm(`Delete document "${docToDelete.name}" from ${displayName}?`)) {
      return;
    }
    const currentDocs = person.documents || [];
    handleUpdate(person.id, {
      documents: currentDocs.filter((d) => d.id !== docToDelete.id),
    });

    try {
      const token = await requestDriveAccessToken();
      if (token && docToDelete.driveFileId) {
        await deleteFileFromDrive(docToDelete.driveFileId, token);
      }
    } catch (err) {
      console.warn('Google Drive delete skipped or failed:', err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Documents & Records
          </h4>
          {documents.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {documents.length}
            </span>
          )}
        </div>

        {!isReadOnly && tree.googleDriveConfig && !isAttachingDoc && (
          <button
            type="button"
            onClick={() => setIsAttachingDoc(true)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Attach
          </button>
        )}
      </div>

      {/* If tree does NOT have Google Drive linked */}
      {!tree.googleDriveConfig ? (
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Folder className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>No Google Drive storage linked to this tree.</span>
          </div>
          {!isReadOnly && handleOpenShareModal && (
            <button
              type="button"
              onClick={handleOpenShareModal}
              className="w-full py-1.5 px-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Configure Google Drive Storage</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Linked Folder Hint */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
            <span className="truncate">
              Storage: <span className="font-semibold text-slate-700 dark:text-slate-300">{tree.googleDriveConfig.folderName}</span>
            </span>
            {tree.googleDriveConfig.folderWebViewLink && (
              <a
                href={tree.googleDriveConfig.folderWebViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 flex-shrink-0"
              >
                <span>Drive</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>

          {/* Upload Form Drawer */}
          {isAttachingDoc && (
            <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-3 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5 text-indigo-600" /> Upload Document to Drive
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachingDoc(false);
                    setSelectedFile(null);
                    setDocDescription('');
                    setUploadError(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {uploadError && (
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div>
                <input
                  type="file"
                  id="attach-doc-file-input"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                      setUploadError(null);
                    }
                  }}
                  className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer text-slate-600 dark:text-slate-300 w-full"
                />
              </div>

              {selectedFile && (
                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                  Selected: <strong className="text-slate-800 dark:text-slate-200">{selectedFile.name}</strong> ({formatFileSize(selectedFile.size)})
                </div>
              )}

              <div>
                <input
                  type="text"
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                  placeholder="Description (e.g. Birth Certificate, Photo 1945)"
                  className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachingDoc(false);
                    setSelectedFile(null);
                    setDocDescription('');
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedFile || isUploading}
                  onClick={handleUploadDocument}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isUploading && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{isUploading ? 'Uploading...' : 'Upload & Attach'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Category Filter Tabs */}
          {documents.length > 0 && (
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px]">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'vital', label: 'Vital Records' },
                  { id: 'photos', label: 'Photos' },
                  { id: 'documents', label: 'Documents' },
                ] as const
              ).map((tab) => {
                const count = countForCategory(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategory(tab.id)}
                    className={`flex-1 py-1 px-1.5 rounded-md font-medium text-center transition-all cursor-pointer truncate ${
                      activeCategory === tab.id
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="ml-1 opacity-75 font-mono text-[10px]">({count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* List of Attached Documents */}
          {documents.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">No documents attached yet</p>
          ) : filteredDocuments.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">
              No files in this category
            </p>
          ) : (
            <div className="space-y-1.5">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg group transition-colors"
                >
                  <div
                    onClick={() =>
                      onPreviewDocument
                        ? onPreviewDocument(doc, displayName)
                        : window.open(
                            doc.webViewLink || `https://drive.google.com/file/d/${doc.driveFileId}/view`,
                            '_blank'
                          )
                    }
                    className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                    title="Click to preview document"
                  >
                    <div className="flex-shrink-0">{renderDocIcon(doc)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {doc.name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
                        {doc.description && <span className="truncate max-w-[120px]">· {doc.description}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onPreviewDocument
                          ? onPreviewDocument(doc, displayName)
                          : window.open(doc.webViewLink, '_blank')
                      }
                      className="px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded transition-colors cursor-pointer"
                      title="Preview document"
                    >
                      View
                    </button>
                    <a
                      href={doc.webViewLink || `https://drive.google.com/file/d/${doc.driveFileId}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                      title="Open in Google Drive"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-all cursor-pointer"
                        title="Delete this document"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
