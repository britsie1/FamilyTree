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
});
