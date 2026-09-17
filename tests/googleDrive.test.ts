import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGoogleDriveFolderId,
  parseGoogleDriveFileId,
  getDriveEmbedUrl,
  formatFileSize,
  getFileCategory,
  getDirectImageUrl,
} from '../src/services/googleDriveService';
import type { PersonDocument } from '../src/types/tree';

describe('Google Drive Service Helpers', () => {
  describe('parseGoogleDriveFolderId', () => {
    it('extracts folder ID from standard drive folder URLs', () => {
      const url1 = 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ_123';
      assert.equal(parseGoogleDriveFolderId(url1), '1aBcDeFgHiJkLmNoPqRsTuVwXyZ_123');

      const url2 = 'https://drive.google.com/drive/u/1/folders/folder_ID_456-789';
      assert.equal(parseGoogleDriveFolderId(url2), 'folder_ID_456-789');

      const url3 = 'https://drive.google.com/open?id=12345678901234567890';
      assert.equal(parseGoogleDriveFolderId(url3), '12345678901234567890');
    });

    it('accepts raw folder IDs directly', () => {
      const rawId = '1Abc-Def_GhiJklMnoPqrStuV';
      assert.equal(parseGoogleDriveFolderId(rawId), rawId);
    });

    it('handles whitespace around input', () => {
      assert.equal(
        parseGoogleDriveFolderId('   1Abc-Def_GhiJklMnoPqrStuV   '),
        '1Abc-Def_GhiJklMnoPqrStuV'
      );
    });

    it('returns null for empty, invalid, or malformed strings', () => {
      assert.equal(parseGoogleDriveFolderId(''), null);
      assert.equal(parseGoogleDriveFolderId(null), null);
      assert.equal(parseGoogleDriveFolderId(undefined), null);
      assert.equal(parseGoogleDriveFolderId('hello world with spaces'), null);
      assert.equal(parseGoogleDriveFolderId('short'), null);
    });
  });

  describe('parseGoogleDriveFileId', () => {
    it('extracts file ID from standard drive file URLs', () => {
      const url1 = 'https://drive.google.com/file/d/1FileId_ABC-123/view?usp=sharing';
      assert.equal(parseGoogleDriveFileId(url1), '1FileId_ABC-123');

      const url2 = 'https://drive.google.com/open?id=File123456789012345';
      assert.equal(parseGoogleDriveFileId(url2), 'File123456789012345');
    });

    it('accepts raw file IDs', () => {
      const raw = '1FileId_ABC-1234567890';
      assert.equal(parseGoogleDriveFileId(raw), raw);
    });
  });

  describe('getDriveEmbedUrl', () => {
    it('builds preview URL from driveFileId', () => {
      const doc: PersonDocument = {
        id: 'doc-1',
        name: 'Birth Certificate.pdf',
        driveFileId: '1AbcDeF-1234567890',
        uploadedAt: '2026-01-01T00:00:00Z',
      };
      assert.equal(
        getDriveEmbedUrl(doc),
        'https://drive.google.com/file/d/1AbcDeF-1234567890/preview'
      );
    });
  });

  describe('formatFileSize', () => {
    it('correctly formats bytes to human readable sizes', () => {
      assert.equal(formatFileSize(0), '0 B');
      assert.equal(formatFileSize(512), '512 B');
      assert.equal(formatFileSize(1024), '1 KB');
      assert.equal(formatFileSize(1536), '1.5 KB');
      assert.equal(formatFileSize(1048576), '1 MB');
      assert.equal(formatFileSize(2621440), '2.5 MB');
      assert.equal(formatFileSize(undefined), '');
      assert.equal(formatFileSize(-10), '');
    });
  });

  describe('getFileCategory', () => {
    it('detects file categories from mime type or extension', () => {
      assert.equal(getFileCategory('image/jpeg', 'photo.jpg'), 'image');
      assert.equal(getFileCategory('', 'portrait.PNG'), 'image');
      assert.equal(getFileCategory('application/pdf', 'cert.pdf'), 'pdf');
      assert.equal(getFileCategory('', 'scan.PDF'), 'pdf');
      assert.equal(getFileCategory('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'bio.docx'), 'document');
      assert.equal(getFileCategory('text/plain', 'notes.txt'), 'document');
      assert.equal(getFileCategory('application/vnd.ms-excel', 'data.xlsx'), 'spreadsheet');
      assert.equal(getFileCategory('audio/mpeg', 'interview.mp3'), 'audio');
      assert.equal(getFileCategory('video/mp4', 'reunion.mp4'), 'video');
      assert.equal(getFileCategory('application/zip', 'archive.zip'), 'archive');
      assert.equal(getFileCategory('unknown/binary', 'file.bin'), 'other');
    });
  });

  describe('getDirectImageUrl', () => {
    it('converts standard Google Drive share URLs to direct thumbnail URLs', () => {
      const shareUrl = 'https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing';
      assert.equal(
        getDirectImageUrl(shareUrl),
        'https://drive.google.com/thumbnail?id=1A2B3C4D5E6F7G8H9I0J&sz=w1000'
      );
    });

    it('converts drive.google.com open id URLs to thumbnail URLs', () => {
      const idUrl = 'https://drive.google.com/open?id=1A2B3C4D5E6F7G8H9I0J';
      assert.equal(
        getDirectImageUrl(idUrl),
        'https://drive.google.com/thumbnail?id=1A2B3C4D5E6F7G8H9I0J&sz=w1000'
      );
    });

    it('converts raw Google Drive file IDs to thumbnail URLs', () => {
      const rawId = '1A2B3C4D5E6F7G8H9I0J12345';
      assert.equal(
        getDirectImageUrl(rawId),
        'https://drive.google.com/thumbnail?id=1A2B3C4D5E6F7G8H9I0J12345&sz=w1000'
      );
    });

    it('preserves standard web image URLs unchanged', () => {
      const regularUrl = 'https://example.com/images/family_portrait.jpg';
      assert.equal(getDirectImageUrl(regularUrl), regularUrl);
    });

    it('preserves data: URLs and blob: URLs unchanged', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      assert.equal(getDirectImageUrl(dataUrl), dataUrl);

      const blobUrl = 'blob:http://localhost:5173/01234567-89ab-cdef';
      assert.equal(getDirectImageUrl(blobUrl), blobUrl);
    });

    it('returns empty string for empty, undefined, or null input', () => {
      assert.equal(getDirectImageUrl(''), '');
      assert.equal(getDirectImageUrl(undefined), '');
      assert.equal(getDirectImageUrl(null), '');
      assert.equal(getDirectImageUrl('   '), '');
    });
  });
});
