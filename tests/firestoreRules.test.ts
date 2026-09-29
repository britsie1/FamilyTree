import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RECOMMENDED_FIRESTORE_RULES, compactCloudTombstones } from '../src/services/firestoreService';

describe('Firestore Security Rules & Shape Validation', () => {
  const firestoreRulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const firestoreRulesContent = fs.readFileSync(firestoreRulesPath, 'utf8');

  it('firestore.rules file and RECOMMENDED_FIRESTORE_RULES constant are consistent', () => {
    // Normalizing whitespace and carriage returns for cross-platform comparison
    const normFile = firestoreRulesContent.replace(/\r\n/g, '\n').trim();
    const normConst = RECOMMENDED_FIRESTORE_RULES.replace(/\r\n/g, '\n').trim();
    assert.equal(normConst, normFile, 'RECOMMENDED_FIRESTORE_RULES must match firestore.rules exactly');
  });

  it('rules contain required shape validators, helper functions, and compaction permissions', () => {
    assert.ok(firestoreRulesContent.includes('function isValidPersonDoc(data, personId)'));
    assert.ok(firestoreRulesContent.includes('function isValidUnionDoc(data, unionId)'));
    assert.ok(firestoreRulesContent.includes('function canReadTree(treeId)'));
    assert.ok(firestoreRulesContent.includes('function isTreeOwner(treeId)'));
    assert.ok(firestoreRulesContent.includes('function canEditTree(treeId)'));
    assert.ok(firestoreRulesContent.includes("resource.data.get('deleted', false) == true"));
  });

  // Pure logic validators mirroring Firestore rule functions exactly
  function isValidPersonDoc(data: Record<string, any>, personId: string): boolean {
    return (
      data.id === personId &&
      typeof data.id === 'string' &&
      typeof data.firstName === 'string' &&
      typeof data.lastName === 'string' &&
      ['male', 'female', 'other', 'unknown', 'unspecified'].includes(data.gender) &&
      Array.isArray(data.unionIds) &&
      (!('deleted' in data) || typeof data.deleted === 'boolean') &&
      (!('rev' in data) || typeof data.rev === 'number') &&
      (!('updatedAt' in data) || typeof data.updatedAt === 'string')
    );
  }

  function isValidUnionDoc(data: Record<string, any>, unionId: string): boolean {
    return (
      data.id === unionId &&
      typeof data.id === 'string' &&
      Array.isArray(data.partnerIds) &&
      Array.isArray(data.childrenIds) &&
      (!('deleted' in data) || typeof data.deleted === 'boolean') &&
      (!('rev' in data) || typeof data.rev === 'number') &&
      (!('updatedAt' in data) || typeof data.updatedAt === 'string')
    );
  }

  function canDeleteDoc(
    user: { uid: string; email?: string } | null,
    treeMeta: { ownerId: string; sharedEmails?: string[]; isPublic?: boolean; publicRole?: string },
    resourceData: Record<string, any>
  ): boolean {
    if (!user) return false;
    const isOwner = user.uid === treeMeta.ownerId;
    const isEditor =
      isOwner ||
      (treeMeta.isPublic === true && treeMeta.publicRole === 'editor') ||
      Boolean(user.email && treeMeta.sharedEmails?.map((e) => e.toLowerCase()).includes(user.email.toLowerCase()));

    return isOwner || (isEditor && resourceData.deleted === true);
  }

  describe('Person Document Shape Validation (isValidPersonDoc)', () => {
    it('accepts valid person document', () => {
      const valid = {
        id: 'p1',
        firstName: 'John',
        lastName: 'Doe',
        gender: 'male',
        unionIds: ['u1'],
        rev: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        deleted: false,
      };
      assert.ok(isValidPersonDoc(valid, 'p1'));
    });

    it('rejects person doc when ID does not match path parameter', () => {
      const badId = {
        id: 'p2',
        firstName: 'John',
        lastName: 'Doe',
        gender: 'male',
        unionIds: [],
      };
      assert.strictEqual(isValidPersonDoc(badId, 'p1'), false);
    });

    it('rejects person doc with invalid gender', () => {
      const badGender = {
        id: 'p1',
        firstName: 'John',
        lastName: 'Doe',
        gender: 'robot',
        unionIds: [],
      };
      assert.strictEqual(isValidPersonDoc(badGender, 'p1'), false);
    });

    it('rejects person doc when unionIds is not a list', () => {
      const badUnions = {
        id: 'p1',
        firstName: 'John',
        lastName: 'Doe',
        gender: 'female',
        unionIds: 'u1',
      };
      assert.strictEqual(isValidPersonDoc(badUnions, 'p1'), false);
    });

    it('rejects person doc with non-boolean deleted field or non-numeric rev', () => {
      const badDeleted = {
        id: 'p1',
        firstName: 'John',
        lastName: 'Doe',
        gender: 'female',
        unionIds: [],
        deleted: 'true',
      };
      assert.strictEqual(isValidPersonDoc(badDeleted, 'p1'), false);

      const badRev = {
        id: 'p1',
        firstName: 'John',
        lastName: 'Doe',
        gender: 'female',
        unionIds: [],
        rev: 'first',
      };
      assert.strictEqual(isValidPersonDoc(badRev, 'p1'), false);
    });
  });

  describe('Union Document Shape Validation (isValidUnionDoc)', () => {
    it('accepts valid union document', () => {
      const valid = {
        id: 'u1',
        partnerIds: ['p1', 'p2'],
        childrenIds: ['p3'],
        rev: 2,
        updatedAt: '2026-01-01T00:00:00.000Z',
        deleted: false,
      };
      assert.ok(isValidUnionDoc(valid, 'u1'));
    });

    it('rejects union doc when partnerIds or childrenIds is missing or not a list', () => {
      const missingPartners = {
        id: 'u1',
        childrenIds: [],
      };
      assert.strictEqual(isValidUnionDoc(missingPartners, 'u1'), false);

      const invalidChildren = {
        id: 'u1',
        partnerIds: [],
        childrenIds: 'p1',
      };
      assert.strictEqual(isValidUnionDoc(invalidChildren, 'u1'), false);
    });
  });

  describe('Tombstone Deletion & Compaction Permissions', () => {
    const tree = {
      ownerId: 'owner-1',
      sharedEmails: ['editor@test.com'],
      isPublic: false,
      publicRole: 'viewer',
    };

    it('tree owner can hard-delete active records and tombstones', () => {
      const ownerUser = { uid: 'owner-1', email: 'owner@test.com' };
      assert.ok(canDeleteDoc(ownerUser, tree, { id: 'p1', deleted: false }));
      assert.ok(canDeleteDoc(ownerUser, tree, { id: 'p1', deleted: true }));
    });

    it('authorized editor cannot delete active records (prevents accidental data loss)', () => {
      const editorUser = { uid: 'editor-1', email: 'editor@test.com' };
      assert.strictEqual(canDeleteDoc(editorUser, tree, { id: 'p1', deleted: false }), false);
      assert.strictEqual(canDeleteDoc(editorUser, tree, { id: 'p1' }), false);
    });

    it('authorized editor CAN delete tombstones during compaction (deleted == true)', () => {
      const editorUser = { uid: 'editor-1', email: 'editor@test.com' };
      assert.ok(canDeleteDoc(editorUser, tree, { id: 'p1', deleted: true }));
    });

    it('unauthorized users or visitors cannot delete tombstones or active records', () => {
      const stranger = { uid: 'stranger-1', email: 'stranger@test.com' };
      assert.strictEqual(canDeleteDoc(stranger, tree, { id: 'p1', deleted: true }), false);
      assert.strictEqual(canDeleteDoc(null, tree, { id: 'p1', deleted: true }), false);
    });
  });

  describe('compactCloudTombstones API', () => {
    it('rejects cleanly when Firebase is unconfigured or treeId is empty', async () => {
      await assert.rejects(
        async () => {
          await compactCloudTombstones('');
        },
        {
          message: /Firebase is not configured or tree ID is missing/,
        }
      );
    });
  });
});
