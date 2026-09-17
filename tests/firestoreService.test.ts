import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail,
  encodeEmailKey,
  decodeEmailKey,
  resolveUserPermission,
  cleanForFirestore,
} from '../src/services/firestoreService';
import type { CloudTreeMetadata } from '../src/types/tree';

describe('Firestore Cloud Service & Permission Resolution', () => {
  const baseTree: CloudTreeMetadata = {
    ownerId: 'owner-uid-123',
    ownerEmail: 'alice@example.com',
    ownerDisplayName: 'Alice',
    isPublic: false,
    publicRole: 'viewer',
    sharedWith: {
      [encodeEmailKey('bob@example.com')]: {
        email: 'bob@example.com',
        role: 'editor',
        addedAt: '2026-01-01T00:00:00Z',
      },
      [encodeEmailKey('charlie@example.com')]: {
        email: 'charlie@example.com',
        role: 'viewer',
        addedAt: '2026-01-01T00:00:00Z',
      },
    },
    sharedEmails: ['bob@example.com', 'charlie@example.com'],
  };

  it('resolves "owner" when user UID matches ownerId', () => {
    const perm = resolveUserPermission(baseTree, { uid: 'owner-uid-123', email: 'alice@example.com' });
    assert.equal(perm, 'owner');
  });

  it('resolves "editor" when user email has editor role in closed list', () => {
    const perm = resolveUserPermission(baseTree, { uid: 'different-uid', email: 'bob@example.com' });
    assert.equal(perm, 'editor');
  });

  it('resolves "viewer" when user email has viewer role in closed list', () => {
    const perm = resolveUserPermission(baseTree, { uid: 'different-uid', email: 'charlie@example.com' });
    assert.equal(perm, 'viewer');
  });

  it('handles case-insensitivity and extra whitespace in user emails', () => {
    const perm = resolveUserPermission(baseTree, { uid: 'different-uid', email: '  BOB@EXAMPLE.COM  ' });
    assert.equal(perm, 'editor');
  });

  it('resolves "none" for non-invited user when tree is restricted (isPublic: false)', () => {
    const perm = resolveUserPermission(baseTree, { uid: 'stranger-uid', email: 'stranger@example.com' });
    assert.equal(perm, 'none');
  });

  it('resolves "none" for unauthenticated visitor when tree is restricted', () => {
    const perm = resolveUserPermission(baseTree, null);
    assert.equal(perm, 'none');
  });

  it('resolves publicRole ("viewer") for any visitor when isPublic is true', () => {
    const publicTree: CloudTreeMetadata = {
      ...baseTree,
      isPublic: true,
      publicRole: 'viewer',
    };

    // Anonymous visitor
    assert.equal(resolveUserPermission(publicTree, null), 'viewer');

    // Signed in uninvited user
    assert.equal(
      resolveUserPermission(publicTree, { uid: 'stranger-uid', email: 'stranger@example.com' }),
      'viewer'
    );
  });

  it('resolves publicRole ("editor") when isPublic is true and publicRole is editor', () => {
    const publicEditTree: CloudTreeMetadata = {
      ...baseTree,
      isPublic: true,
      publicRole: 'editor',
    };

    assert.equal(resolveUserPermission(publicEditTree, null), 'editor');
  });

  it('correctly encodes and decodes email keys for Firestore nested documents', () => {
    const email = 'Jane.Doe+Family@Sub.Example.com';
    const encoded = encodeEmailKey(email);

    // Cannot contain raw dots or @ in map keys
    assert.ok(!encoded.includes('@'));
    assert.ok(!encoded.includes('.'));

    const decoded = decodeEmailKey(encoded);
    assert.equal(decoded, normalizeEmail(email));
  });

  it('cleanForFirestore strips undefined values recursively without modifying valid data', () => {
    const input = {
      id: 'tree1',
      name: 'Test Tree',
      notes: undefined,
      nested: {
        value: 42,
        extra: undefined,
        arr: ['a', undefined, 'b'],
      },
    };

    const cleaned = cleanForFirestore(input);
    assert.deepEqual(cleaned, {
      id: 'tree1',
      name: 'Test Tree',
      nested: {
        value: 42,
        arr: ['a', 'b'],
      },
    });
  });

  it('updateCloudTreeData rejects cleanly if tree ID is missing or Firebase is unconfigured in test environment', async () => {
    const { updateCloudTreeData } = await import('../src/services/firestoreService');
    await assert.rejects(
      async () => {
        await updateCloudTreeData({ id: '', name: 'Empty', people: {}, unions: {} });
      },
      {
        message: /Firebase is not configured or tree ID is missing/,
      }
    );
  });

  it('patchCloudPerson rejects cleanly if tree ID is missing or Firebase is unconfigured', async () => {
    const { patchCloudPerson } = await import('../src/services/firestoreService');
    await assert.rejects(
      async () => {
        await patchCloudPerson('', 'p1', { firstName: 'Alice' });
      },
      {
        message: /Firebase is not configured or tree ID is missing/,
      }
    );
  });

  it('patchCloudUnion rejects cleanly if tree ID is missing or Firebase is unconfigured', async () => {
    const { patchCloudUnion } = await import('../src/services/firestoreService');
    await assert.rejects(
      async () => {
        await patchCloudUnion('', 'u1', { type: 'married' });
      },
      {
        message: /Firebase is not configured or tree ID is missing/,
      }
    );
  });

  it('migrateTreeToSubcollections rejects cleanly if tree ID is missing or Firebase is unconfigured', async () => {
    const { migrateTreeToSubcollections } = await import('../src/services/firestoreService');
    await assert.rejects(
      async () => {
        await migrateTreeToSubcollections('');
      },
      {
        message: /Firebase is not configured or tree ID is missing/,
      }
    );
  });

  it('estimateTreeDocumentSize computes byte size and detects trees approaching 1 MB threshold', async () => {
    const { estimateTreeDocumentSize, FIRESTORE_MAX_DOC_BYTES, FIRESTORE_WARN_DOC_BYTES } =
      await import('../src/services/firestoreService');

    const smallTree = {
      id: 'tree1',
      name: 'Small Tree',
      people: { p1: { id: 'p1', firstName: 'Alice' } },
      unions: {},
    };
    const smallSize = estimateTreeDocumentSize(smallTree);
    assert.ok(smallSize > 0);
    assert.ok(smallSize < 1000);

    // Construct a large tree with detailed person notes
    const largeTree: Record<string, any> = {
      id: 'tree_large',
      name: 'Large Tree',
      people: {},
      unions: {},
    };
    const largeNote = 'A'.repeat(10 * 1024); // 10 KB per person
    for (let i = 0; i < 90; i++) {
      largeTree.people[`p_${i}`] = {
        id: `p_${i}`,
        firstName: `Person ${i}`,
        notes: largeNote,
      };
    }

    const largeSize = estimateTreeDocumentSize(largeTree);
    // 90 * 10KB ~ 900KB, which exceeds FIRESTORE_WARN_DOC_BYTES (800KB)
    assert.ok(
      largeSize > FIRESTORE_WARN_DOC_BYTES,
      `Expected largeSize (${largeSize}) to exceed warning threshold (${FIRESTORE_WARN_DOC_BYTES})`
    );
    assert.ok(largeSize < FIRESTORE_MAX_DOC_BYTES * 2);
  });

  it('ConcurrencyConflictError contains serverVersion, baseVersion, and conflict list', async () => {
    const { ConcurrencyConflictError } = await import('../src/services/firestoreService');
    const err = new ConcurrencyConflictError('Conflict on field', 5, 4, ['people.p1.notes']);
    assert.equal(err.name, 'ConcurrencyConflictError');
    assert.equal(err.serverVersion, 5);
    assert.equal(err.baseVersion, 4);
    assert.deepEqual(err.conflicts, ['people.p1.notes']);
  });

  it('RECOMMENDED_FIRESTORE_RULES includes security rules for the /people/{personId} subcollection', async () => {
    const { RECOMMENDED_FIRESTORE_RULES } = await import('../src/services/firestoreService');
    assert.ok(RECOMMENDED_FIRESTORE_RULES.includes('match /people/{personId}'));
    assert.ok(RECOMMENDED_FIRESTORE_RULES.includes('isPublicEditor()'));
    assert.ok(RECOMMENDED_FIRESTORE_RULES.includes('isInvitedCollaborator()'));
  });
});
