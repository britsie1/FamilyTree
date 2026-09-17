import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  attachDocumentToPerson,
  removeDocumentFromPerson,
  updateTreeGoogleDriveConfig,
  sanitizeTree,
} from '../src/services/treeOperations';
import {
  cleanForFirestore,
  resolveUserPermission,
} from '../src/services/firestoreService';
import type { TreeData, PersonDocument, GoogleDriveConfig, CloudTreeMetadata } from '../src/types/tree';

describe('Person Documents & Google Drive Tree Storage', () => {
  const sampleDoc: PersonDocument = {
    id: 'doc-101',
    name: 'Birth_Certificate_1890.pdf',
    fileType: 'application/pdf',
    fileSize: 1048576,
    driveFileId: 'drive-file-abc-123',
    webViewLink: 'https://drive.google.com/file/d/drive-file-abc-123/view',
    webContentLink: 'https://drive.google.com/uc?id=drive-file-abc-123&export=download',
    uploadedAt: '2026-03-01T12:00:00Z',
    uploadedBy: {
      uid: 'user-editor-1',
      name: 'Genealogist John',
      email: 'john@example.com',
    },
    description: 'Original scan from municipal archive',
  };

  const sampleTree: TreeData = {
    id: 'tree-1',
    name: 'Smith Dynasty',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    people: {
      p1: {
        id: 'p1',
        firstName: 'John',
        lastName: 'Smith',
        gender: 'male',
        unionIds: [],
      },
    },
    unions: {},
  };

  it('attaches a document to a person in the tree', () => {
    const updated = attachDocumentToPerson(sampleTree, 'p1', sampleDoc);

    const p = updated.people['p1'];
    assert.ok(p.documents);
    assert.equal(p.documents.length, 1);
    assert.equal(p.documents[0].id, 'doc-101');
    assert.equal(p.documents[0].name, 'Birth_Certificate_1890.pdf');
    assert.equal(p.documents[0].driveFileId, 'drive-file-abc-123');
    assert.ok(new Date(updated.updatedAt).getTime() >= new Date(sampleTree.updatedAt).getTime());
  });

  it('appends multiple documents to an existing document array', () => {
    const doc2: PersonDocument = {
      id: 'doc-102',
      name: 'Family_Photo_1920.jpg',
      fileType: 'image/jpeg',
      fileSize: 2048000,
      driveFileId: 'drive-photo-789',
      uploadedAt: '2026-03-02T12:00:00Z',
    };

    const step1 = attachDocumentToPerson(sampleTree, 'p1', sampleDoc);
    const step2 = attachDocumentToPerson(step1, 'p1', doc2);

    assert.equal(step2.people['p1'].documents?.length, 2);
    assert.equal(step2.people['p1'].documents?.[1].name, 'Family_Photo_1920.jpg');
  });

  it('removes an attached document from a person by ID', () => {
    const doc2: PersonDocument = {
      id: 'doc-102',
      name: 'Family_Photo_1920.jpg',
      fileType: 'image/jpeg',
      driveFileId: 'drive-photo-789',
      uploadedAt: '2026-03-02T12:00:00Z',
    };

    const treeWithDocs = attachDocumentToPerson(
      attachDocumentToPerson(sampleTree, 'p1', sampleDoc),
      'p1',
      doc2
    );

    const afterRemoval = removeDocumentFromPerson(treeWithDocs, 'p1', 'doc-101');
    assert.equal(afterRemoval.people['p1'].documents?.length, 1);
    assert.equal(afterRemoval.people['p1'].documents?.[0].id, 'doc-102');
  });

  it('updates and removes Google Drive configuration on the tree', () => {
    const driveConfig: GoogleDriveConfig = {
      folderId: 'folder-xyz-123',
      folderName: 'FamilyTree - Smith Dynasty',
      folderWebViewLink: 'https://drive.google.com/drive/folders/folder-xyz-123',
      linkedByEmail: 'manager@example.com',
      linkedAt: '2026-03-01T10:00:00Z',
      autoSyncPermissions: true,
    };

    const configuredTree = updateTreeGoogleDriveConfig(sampleTree, driveConfig);
    assert.deepEqual(configuredTree.googleDriveConfig, driveConfig);

    const unlinkedTree = updateTreeGoogleDriveConfig(configuredTree, null);
    assert.equal(unlinkedTree.googleDriveConfig, undefined);
  });

  it('preserves documents and Google Drive configuration through sanitizeTree', () => {
    const driveConfig: GoogleDriveConfig = {
      folderId: 'folder-xyz-123',
      folderName: 'FamilyTree - Smith Dynasty',
      linkedByEmail: 'manager@example.com',
    };

    const treeWithEverything = updateTreeGoogleDriveConfig(
      attachDocumentToPerson(sampleTree, 'p1', sampleDoc),
      driveConfig
    );

    const sanitized = sanitizeTree(treeWithEverything);
    assert.equal(sanitized.googleDriveConfig?.folderId, 'folder-xyz-123');
    assert.equal(sanitized.people['p1'].documents?.length, 1);
    assert.equal(sanitized.people['p1'].documents?.[0].driveFileId, 'drive-file-abc-123');
  });

  it('cleans documents and Drive config properly for Firestore without stripping data', () => {
    const driveConfig: GoogleDriveConfig = {
      folderId: 'folder-xyz-123',
      folderName: 'FamilyTree - Smith Dynasty',
      linkedByEmail: 'manager@example.com',
    };

    const docWithUndefined: PersonDocument = {
      id: 'doc-999',
      name: 'Doc With Undefined.pdf',
      driveFileId: 'drive-999',
      uploadedAt: '2026-01-01T00:00:00Z',
      description: undefined,
      thumbnailLink: undefined,
    };

    const tree = updateTreeGoogleDriveConfig(
      attachDocumentToPerson(sampleTree, 'p1', docWithUndefined),
      driveConfig
    );

    const cleaned = cleanForFirestore(tree);
    assert.equal(cleaned.googleDriveConfig?.folderId, 'folder-xyz-123');
    assert.equal(cleaned.people.p1.documents[0].driveFileId, 'drive-999');
    // Undefined fields should be removed by cleanForFirestore
    assert.equal('description' in cleaned.people.p1.documents[0], false);
  });

  it('enforces viewer vs editor permissions on document actions', () => {
    const treeMeta: CloudTreeMetadata = {
      ownerId: 'owner-uid',
      ownerEmail: 'owner@example.com',
      isPublic: true,
      publicRole: 'viewer',
      sharedWith: {
        'editor%40example%2Ecom': {
          email: 'editor@example.com',
          role: 'editor',
          addedAt: '2026-01-01T00:00:00Z',
        },
      },
      sharedEmails: ['editor@example.com'],
    };

    // Public anonymous user is viewer: can view documents, cannot attach or delete
    const anonPerm = resolveUserPermission(treeMeta, null);
    assert.equal(anonPerm, 'viewer');

    // Invited collaborator is editor: can view, attach, and delete documents
    const editorPerm = resolveUserPermission(treeMeta, {
      uid: 'other-uid',
      email: 'editor@example.com',
    });
    assert.equal(editorPerm, 'editor');

    // Owner has owner role: full document management and Google Drive linking
    const ownerPerm = resolveUserPermission(treeMeta, {
      uid: 'owner-uid',
      email: 'owner@example.com',
    });
    assert.equal(ownerPerm, 'owner');
  });
});
