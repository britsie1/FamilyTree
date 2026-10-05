import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  attachDocumentToUnion,
  removeDocumentFromUnion,
  updateUnionInTree,
  sanitizeTree,
} from '../src/services/treeOperations';
import { cleanForFirestore } from '../src/services/firestoreService';
import { validateUnion } from '../src/services/schema/validators';
import { threeWayMergeUnion } from '../src/services/treeMerge';
import { exportGedcom, parseGedcom } from '../src/services/gedcomService';
import type { TreeData, Union, PersonDocument } from '../src/types/tree';

describe('Union Documents, Comments, and Supporting Metadata', () => {
  const sampleDoc: PersonDocument = {
    id: 'doc-marr-1',
    name: 'Marriage_Certificate_1920.pdf',
    fileType: 'application/pdf',
    fileSize: 2048100,
    driveFileId: 'drive-file-marriage-1',
    webViewLink: 'https://drive.google.com/file/d/drive-file-marriage-1/view',
    webContentLink: 'https://drive.google.com/uc?id=drive-file-marriage-1&export=download',
    uploadedAt: '2026-03-01T12:00:00Z',
    uploadedBy: {
      uid: 'user-1',
      name: 'Archivist Jane',
      email: 'jane@example.com',
    },
    description: 'Parish register marriage entry',
    documentType: 'Marriage Certificate',
    documentDate: '15 June 1920',
    documentPlace: 'St Mary Church, London',
    sourceReference: 'Parish Book 12, Page 45',
    transcription: 'Witnessed by Thomas Smith and Sarah Jones',
  };

  const sampleTree: TreeData = {
    id: 'tree-union-1',
    name: 'Test Tree',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    people: {
      p1: { id: 'p1', firstName: 'John', lastName: 'Doe', gender: 'male', unionIds: ['u1'] },
      p2: { id: 'p2', firstName: 'Jane', lastName: 'Smith', gender: 'female', unionIds: ['u1'] },
    },
    unions: {
      u1: {
        id: 'u1',
        partnerIds: ['p1', 'p2'],
        childrenIds: [],
        type: 'married',
        marriageDate: '1920-06-15',
      },
    },
  };

  it('attaches a document to a union in the tree', () => {
    const updated = attachDocumentToUnion(sampleTree, 'u1', sampleDoc);

    const u = updated.unions['u1'];
    assert.ok(u.documents);
    assert.equal(u.documents.length, 1);
    assert.equal(u.documents[0].id, 'doc-marr-1');
    assert.equal(u.documents[0].name, 'Marriage_Certificate_1920.pdf');
    assert.equal(u.documents[0].documentType, 'Marriage Certificate');
    assert.equal(u.documents[0].documentDate, '15 June 1920');
    assert.equal(u.documents[0].documentPlace, 'St Mary Church, London');
    assert.equal(u.documents[0].sourceReference, 'Parish Book 12, Page 45');
    assert.equal(u.documents[0].transcription, 'Witnessed by Thomas Smith and Sarah Jones');
    assert.ok(new Date(updated.updatedAt).getTime() >= new Date(sampleTree.updatedAt).getTime());
  });

  it('removes an attached document from a union', () => {
    const attached = attachDocumentToUnion(sampleTree, 'u1', sampleDoc);
    const removed = removeDocumentFromUnion(attached, 'u1', 'doc-marr-1');

    assert.equal(removed.unions['u1'].documents?.length, 0);
  });

  it('updates free text comments and notes on a union', () => {
    const updated = updateUnionInTree(sampleTree, 'u1', {
      notes: 'Ceremony was officiated by Rev. Arthur Edwards.',
      comments: 'Ceremony was officiated by Rev. Arthur Edwards.',
    });

    assert.equal(updated.unions['u1'].notes, 'Ceremony was officiated by Rev. Arthur Edwards.');
    assert.equal(updated.unions['u1'].comments, 'Ceremony was officiated by Rev. Arthur Edwards.');
  });

  it('preserves union documents, comments and supporting metadata through sanitizeTree and cleanForFirestore', () => {
    const withDocAndComment = updateUnionInTree(
      attachDocumentToUnion(sampleTree, 'u1', sampleDoc),
      'u1',
      { notes: 'Original ceremony in London.' }
    );

    const cleaned = cleanForFirestore(withDocAndComment);
    const sanitized = sanitizeTree(JSON.parse(JSON.stringify(cleaned)));

    const u = sanitized.unions['u1'];
    assert.equal(u.notes, 'Original ceremony in London.');
    assert.ok(u.documents);
    assert.equal(u.documents.length, 1);
    assert.deepEqual(u.documents[0], sampleDoc);
  });

  it('validates unions with documents, notes and comments correctly', () => {
    const validUnion: Union = {
      id: 'u1',
      partnerIds: ['p1', 'p2'],
      childrenIds: [],
      notes: 'Marriage note',
      comments: 'Marriage comment',
      documents: [sampleDoc],
    };

    assert.equal(validateUnion(validUnion).success, true);

    const invalidUnionNotes = { ...validUnion, notes: 12345 };
    assert.equal(validateUnion(invalidUnionNotes).success, false);

    const invalidUnionDocs = { ...validUnion, documents: 'not-an-array' };
    assert.equal(validateUnion(invalidUnionDocs).success, false);

    const invalidDocInUnion = { ...validUnion, documents: [{ id: '' }] };
    assert.equal(validateUnion(invalidDocInUnion).success, false);
  });

  it('performs 3-way merge on union documents and comments', () => {
    const base: Union = {
      id: 'u1',
      partnerIds: ['p1', 'p2'],
      childrenIds: [],
    };

    const doc2: PersonDocument = {
      ...sampleDoc,
      id: 'doc-marr-2',
      name: 'Ceremony_Photo.jpg',
    };

    const local: Union = {
      ...base,
      notes: 'Local note',
      documents: [sampleDoc],
    };

    const remote: Union = {
      ...base,
      documents: [doc2],
    };

    const result = threeWayMergeUnion(base, local, remote, 'u1');
    assert.equal(result.hasConflict, false);
    assert.equal(result.mergedUnion.notes, 'Local note');
    assert.equal(result.mergedUnion.documents?.length, 2);
    assert.ok(result.mergedUnion.documents?.some((d) => d.id === 'doc-marr-1'));
    assert.ok(result.mergedUnion.documents?.some((d) => d.id === 'doc-marr-2'));
  });

  it('exports and imports union notes/comments in GEDCOM format', () => {
    const treeWithNote: TreeData = {
      ...sampleTree,
      unions: {
        u1: {
          ...sampleTree.unions['u1'],
          notes: 'Married in St Mary Church under special licence.',
        },
      },
    };

    const gedcom = exportGedcom(treeWithNote);
    assert.ok(gedcom.includes('NOTE Married in St Mary Church under special licence.'));

    const parsed = parseGedcom(gedcom);
    const parsedUnion = Object.values(parsed.unions)[0];
    assert.ok(parsedUnion);
    assert.equal(parsedUnion.notes, 'Married in St Mary Church under special licence.');
    assert.equal(parsedUnion.comments, 'Married in St Mary Church under special licence.');
  });

  it('manages union documents and comments through useTreeStore actions', async () => {
    const { useTreeStore } = await import('../src/stores/useTreeStore.ts');
    useTreeStore.getState().resetHistory(sampleTree);

    useTreeStore.getState().updateUnion('u1', {
      notes: 'Notes via store',
      comments: 'Notes via store',
    });
    assert.equal(useTreeStore.getState().tree.unions['u1'].notes, 'Notes via store');

    useTreeStore.getState().attachDocumentToUnion('u1', sampleDoc);
    assert.equal(useTreeStore.getState().tree.unions['u1'].documents?.length, 1);
    assert.equal(useTreeStore.getState().tree.unions['u1'].documents?.[0].id, 'doc-marr-1');

    useTreeStore.getState().removeDocumentFromUnion('u1', 'doc-marr-1');
    assert.equal(useTreeStore.getState().tree.unions['u1'].documents?.length, 0);
  });
});
