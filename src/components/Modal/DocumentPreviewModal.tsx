import React, { useState } from 'react';
import type { PersonDocument } from '../../types/tree';
import {
  getDriveEmbedUrl,
  formatFileSize,
  getFileCategory,
} from '../../services/googleDriveService';
import {
  X,
  ExternalLink,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive,
  Music,
  Video,
  File,
  Loader2,
  Calendar,
  User,
  HardDrive,
} from 'lucide-react';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: PersonDocument | null;
  personName?: string;
  isReadOnly?: boolean;
  onDelete?: (documentId: string) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document,
  personName,
  isReadOnly = false,
  onDelete,
}) => {
  const [iframeLoading, setIframeLoading] = useState(true);

  if (!isOpen || !document) return null;

  const category = getFileCategory(document.fileType, document.name);
  const embedUrl = getDriveEmbedUrl(document);
  const directLink = document.webViewLink || `https://drive.google.com/file/d/${document.driveFileId}/view`;

  const renderIcon = () => {
    switch (category) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-emerald-500" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-500" />;
      case 'spreadsheet':
        return <FileSpreadsheet className="w-5 h-5 text-teal-500" />;
      case 'archive':
        return <FileArchive className="w-5 h-5 text-amber-500" />;
      case 'audio':
        return <Music className="w-5 h-5 text-purple-500" />;
      case 'video':
        return <Video className="w-5 h-5 text-indigo-500" />;
      case 'document':
        return <FileText className="w-5 h-5 text-blue-500" />;
      default:
        return <File className="w-5 h-5 text-slate-500" />;
    }
  };

  const formattedDate = (() => {
    try {
      return new Date(document.uploadedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return document.uploadedAt;
    }
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Document Preview"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl h-[90vh] max-h-[850px] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-2xs flex-shrink-0">
              {renderIcon()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate" title={document.name}>
                {document.name}
              </h3>
              {personName && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Attached to <span className="font-semibold text-slate-700 dark:text-slate-300">{personName}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href={directLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Open directly in Google Drive"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="flex-1 relative bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100/90 dark:bg-slate-950/90 z-10">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Loading document preview...</span>
            </div>
          )}

          <iframe
            src={embedUrl}
            title={document.name}
            className="w-full h-full border-0"
            allow="autoplay"
            onLoad={() => setIframeLoading(false)}
          />
        </div>

        {/* Details & Action Bar */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 dark:text-slate-400">
            {document.fileSize && (
              <span className="flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5" />
                {formatFileSize(document.fileSize)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </span>
            {document.uploadedBy && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {document.uploadedBy.name || document.uploadedBy.email || 'Editor'}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {!isReadOnly && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete "${document.name}"?`)) {
                    onDelete(document.id);
                    onClose();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-medium transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            {document.webContentLink && (
              <a
                href={document.webContentLink}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            )}

            <a
              href={directLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Google Drive</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
