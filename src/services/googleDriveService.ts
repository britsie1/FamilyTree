import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';
import type { PersonDocument, GoogleDriveConfig } from '../types/tree';
import { generateId } from './storage';

const DRIVE_TOKEN_KEY = 'ft_google_drive_access_token';
const DRIVE_TOKEN_EXP_KEY = 'ft_google_drive_access_token_exp';

// Scopes required for creating/managing files and permissions created by this app
export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * Extracts a Google Drive Folder ID from standard Google Drive URLs or returns cleaned ID.
 * Supports:
 * - https://drive.google.com/drive/folders/1ABCxyz...
 * - https://drive.google.com/drive/u/0/folders/1ABCxyz...
 * - https://drive.google.com/open?id=1ABCxyz...
 * - 1ABCxyz...
 */
export function parseGoogleDriveFolderId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // URL matching
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];

  const openMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  // Raw ID check (typically 20-50 chars alphanumeric, no spaces, no slashes, no colons)
  if (/^[a-zA-Z0-9_-]{10,100}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Extracts a Google Drive File ID from standard Google Drive file URLs or returns cleaned ID.
 */
export function parseGoogleDriveFileId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fileMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  const openMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  if (/^[a-zA-Z0-9_-]{10,100}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Retrieves the cached Google Drive OAuth access token if still valid.
 */
export function getStoredDriveToken(): string | null {
  try {
    const token = sessionStorage.getItem(DRIVE_TOKEN_KEY);
    const expStr = sessionStorage.getItem(DRIVE_TOKEN_EXP_KEY);
    if (!token || !expStr) return null;

    const exp = parseInt(expStr, 10);
    // Return null if expired (with 60-second safety cushion)
    if (Date.now() > exp - 60000) {
      clearStoredDriveToken();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

/**
 * Caches the Google Drive OAuth access token in sessionStorage.
 */
export function storeDriveToken(token: string, expiresInSeconds = 3500): void {
  try {
    const exp = Date.now() + expiresInSeconds * 1000;
    sessionStorage.setItem(DRIVE_TOKEN_KEY, token);
    sessionStorage.setItem(DRIVE_TOKEN_EXP_KEY, exp.toString());
  } catch {
    // Ignore storage issues
  }
}

/**
 * Clears cached Google Drive token.
 */
export function clearStoredDriveToken(): void {
  try {
    sessionStorage.removeItem(DRIVE_TOKEN_KEY);
    sessionStorage.removeItem(DRIVE_TOKEN_EXP_KEY);
  } catch {
    // Ignore storage issues
  }
}

/**
 * Requests a Google Drive OAuth access token from Firebase Auth using popup.
 * Requests the drive.file scope so the app only accesses files it creates.
 */
export async function requestDriveAccessToken(): Promise<string> {
  const cached = getStoredDriveToken();
  if (cached) return cached;

  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase Auth is not configured.');
  }

  const driveProvider = new GoogleAuthProvider();
  driveProvider.addScope(GOOGLE_DRIVE_FILE_SCOPE);
  driveProvider.setCustomParameters({
    prompt: 'consent',
    access_type: 'offline',
  });

  try {
    const result = await signInWithPopup(auth, driveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('No access token returned from Google authentication.');
    }

    storeDriveToken(token, 3500);
    return token;
  } catch (err: any) {
    console.error('Google Drive authorization error:', err);
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      throw new Error('Google authorization was cancelled.');
    }
    if (err.code === 'auth/popup-blocked') {
      throw new Error('The authorization popup was blocked by your browser. Please allow popups.');
    }
    throw new Error(err.message || 'Failed to authorize with Google Drive.');
  }
}

/**
 * Creates a dedicated folder for a family tree on Google Drive.
 */
export async function createTreeFolder(
  treeName: string,
  accessToken: string,
  managerInfo?: { email?: string; name?: string }
): Promise<GoogleDriveConfig> {
  const folderName = `FamilyTree - ${treeName || 'Documents'}`;

  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: `Document storage for Family Tree: ${treeName || 'Unnamed Tree'}`,
    }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const msg = errJson?.error?.message || `Google Drive API error (${response.status})`;
    throw new Error(`Failed to create Google Drive folder: ${msg}`);
  }

  const data = await response.json();

  return {
    folderId: data.id,
    folderName: data.name || folderName,
    folderWebViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`,
    linkedByEmail: managerInfo?.email || '',
    linkedByName: managerInfo?.name || '',
    linkedAt: new Date().toISOString(),
    autoSyncPermissions: true,
  };
}

/**
 * Verifies and fetches folder metadata for an existing Google Drive folder.
 */
export async function getDriveFolderMetadata(
  folderId: string,
  accessToken: string
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const cleanId = parseGoogleDriveFolderId(folderId);
  if (!cleanId) {
    throw new Error('Invalid Google Drive folder ID or URL.');
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${cleanId}?fields=id,name,mimeType,webViewLink,trashed`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const msg = errJson?.error?.message || `Google Drive API error (${response.status})`;
    throw new Error(`Could not access Google Drive folder: ${msg}. Make sure the folder exists and you have access.`);
  }

  const data = await response.json();
  if (data.trashed) {
    throw new Error('The specified Google Drive folder is in the Trash.');
  }

  return {
    id: data.id,
    name: data.name,
    webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`,
  };
}

/**
 * Uploads a local file into a specific Google Drive folder using multipart upload.
 */
export async function uploadFileToDrive(
  file: File,
  folderId: string,
  accessToken: string,
  metadata?: {
    description?: string;
    user?: { uid?: string; name?: string; email?: string };
  }
): Promise<PersonDocument> {
  const boundary = `ft_boundary_${generateId('bnd')}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const fileMetadata = {
    name: file.name,
    parents: [folderId],
    description: metadata?.description || '',
  };

  const fileBuffer = await file.arrayBuffer();
  const fileType = file.type || 'application/octet-stream';

  const metadataPart =
    `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(fileMetadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: ${fileType}\r\n\r\n`;

  const metadataBlob = new Blob([metadataPart], { type: 'text/plain' });
  const fileBlob = new Blob([fileBuffer], { type: fileType });
  const closingBlob = new Blob([closeDelimiter], { type: 'text/plain' });

  const multipartBlob = new Blob([metadataBlob, fileBlob, closingBlob], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,thumbnailLink,size,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBlob,
    }
  );

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const msg = errJson?.error?.message || `Google Drive API error (${response.status})`;
    throw new Error(`File upload to Google Drive failed: ${msg}`);
  }

  const uploaded = await response.json();

  return {
    id: generateId('doc'),
    name: file.name,
    fileType: uploaded.mimeType || file.type || 'application/octet-stream',
    fileSize: file.size || (uploaded.size ? parseInt(uploaded.size, 10) : undefined),
    driveFileId: uploaded.id,
    webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
    webContentLink: uploaded.webContentLink,
    thumbnailLink: uploaded.thumbnailLink,
    uploadedAt: uploaded.createdTime || new Date().toISOString(),
    uploadedBy: metadata?.user,
    description: metadata?.description,
  };
}

/**
 * Deletes a file from Google Drive.
 */
export async function deleteFileFromDrive(fileId: string, accessToken: string): Promise<boolean> {
  const cleanId = parseGoogleDriveFileId(fileId) || fileId;
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${cleanId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 404) {
      // File already removed from Drive
      return true;
    }

    return response.ok;
  } catch (err) {
    console.warn(`Failed to delete file ${fileId} from Drive:`, err);
    return false;
  }
}

/**
 * Synchronizes tree permissions to the linked Google Drive folder:
 * - If the tree is public: grants 'anyone' role ('reader' or 'writer')
 * - For shared emails: grants 'user' role ('reader' or 'writer')
 */
export async function syncDrivePermissions(
  folderId: string,
  isPublic: boolean,
  publicRole: 'viewer' | 'editor',
  sharedEmails: string[],
  accessToken: string
): Promise<{ syncedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let syncedCount = 0;

  // 1. If public, set or ensure anyone permission
  if (isPublic) {
    try {
      const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: publicRole === 'editor' ? 'writer' : 'reader',
          type: 'anyone',
        }),
      });
      if (resp.ok) syncedCount++;
    } catch (err: any) {
      errors.push(`Public permission error: ${err.message}`);
    }
  }

  // 2. Grant permissions to shared collaborator emails
  for (const email of sharedEmails) {
    if (!email || !email.includes('@')) continue;
    try {
      const resp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=false`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: 'writer', // or reader depending on specific email role
            type: 'user',
            emailAddress: email.trim().toLowerCase(),
          }),
        }
      );
      if (resp.ok) {
        syncedCount++;
      } else {
        const data = await resp.json().catch(() => ({}));
        if (data?.error?.message) {
          errors.push(`${email}: ${data.error.message}`);
        }
      }
    } catch (err: any) {
      errors.push(`${email}: ${err.message}`);
    }
  }

  return { syncedCount, errors };
}

/**
 * Generates the safe Google Drive preview embed URL for an attached document.
 */
export function getDriveEmbedUrl(doc: PersonDocument): string {
  const fileId = parseGoogleDriveFileId(doc.driveFileId) || doc.driveFileId;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Formats a file size in bytes to a human-readable string (e.g. 2.4 MB).
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Categorizes a file type for UI icon selection and preview layout.
 */
export function getFileCategory(
  fileType?: string,
  fileName?: string
): 'image' | 'pdf' | 'document' | 'spreadsheet' | 'audio' | 'video' | 'archive' | 'other' {
  const type = (fileType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();

  if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name)) {
    return 'image';
  }
  if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
    return 'pdf';
  }
  if (
    type.includes('word') ||
    type.includes('text') ||
    type.includes('document') ||
    /\.(doc|docx|odt|rtf|txt|md)$/i.test(name)
  ) {
    return 'document';
  }
  if (
    type.includes('sheet') ||
    type.includes('excel') ||
    type.includes('csv') ||
    /\.(xls|xlsx|csv|ods)$/i.test(name)
  ) {
    return 'spreadsheet';
  }
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(name)) {
    return 'audio';
  }
  if (type.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv)$/i.test(name)) {
    return 'video';
  }
  if (
    type.includes('zip') ||
    type.includes('tar') ||
    type.includes('compressed') ||
    /\.(zip|rar|7z|tar|gz)$/i.test(name)
  ) {
    return 'archive';
  }
  return 'other';
}

/**
 * Normalizes an image URL or Google Drive file URL/ID to a direct browser-renderable image URL.
 * If given a Google Drive link (e.g. drive.google.com/file/d/XYZ/view or ?id=XYZ),
 * converts it to https://drive.google.com/thumbnail?id=XYZ&sz=w1000 so it renders directly in <img> tags.
 * If given a regular URL, blob:, or data: URL, returns it as-is.
 */
export function getDirectImageUrl(urlOrDriveId?: string | null): string {
  if (!urlOrDriveId) return '';
  const trimmed = urlOrDriveId.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  const driveId = parseGoogleDriveFileId(trimmed);
  if (
    driveId &&
    (trimmed.includes('drive.google.com') ||
      trimmed.includes('docs.google.com') ||
      !trimmed.startsWith('http'))
  ) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
  }

  return trimmed;
}

/**
 * Reads a local image file as a base64 Data URL (useful for local trees or offline fallback).
 */
export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

