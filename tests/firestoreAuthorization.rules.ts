import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { encodeEmailKey } from '../src/services/firestoreService';

// Intentionally outside *.test.ts discovery: this suite requires the emulator
// and is always executed separately by npm run test:rules (including in CI).
describe('Firestore authorization (actual rules)', () => {
  let environment: RulesTestEnvironment;
  const editorEmail = 'Jane.Doe+100%/Family@Sub.Example.com';
  const viewerEmail = 'viewer@example.com';
  const metadata = {
    ownerId: 'owner', ownerEmail: 'owner@example.com', ownerDisplayName: 'Owner',
    isPublic: false, publicRole: 'viewer', name: 'Family',
    sharedEmails: [editorEmail.toLowerCase(), viewerEmail, 'legacy@example.com'],
    sharedWith: {
      [encodeEmailKey(editorEmail)]: { email: editorEmail.toLowerCase(), role: 'editor' },
      [encodeEmailKey(viewerEmail)]: { email: viewerEmail, role: 'viewer' },
    },
    people: {}, unions: {},
  };
  const database = (uid: string | null, email?: string) => uid === null
    ? environment.unauthenticatedContext().firestore()
    : environment.authenticatedContext(uid, email ? { email } : {}).firestore();
  const root = (uid: string | null, email?: string) => doc(database(uid, email), 'trees/private');

  before(async () => {
    // Never allow these tests to connect to a production Firebase project.
    assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Run this suite with npm run test:rules');
    environment = await initializeTestEnvironment({
      projectId: 'demo-familytree',
      firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
    });
  });
  after(async () => { await environment?.cleanup(); });
  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'trees/private'), metadata);
      await setDoc(doc(db, 'trees/public-viewer'), { ...metadata, isPublic: true });
      await setDoc(doc(db, 'trees/public-editor'), { ...metadata, isPublic: true, publicRole: 'editor' });
      await setDoc(doc(db, 'trees/no-sharing-fields'), { ownerId: 'owner', isPublic: true });
      for (const kind of ['people', 'unions']) {
        await setDoc(doc(db, `trees/private/${kind}/active`), { id: 'active' });
        await setDoc(doc(db, `trees/private/${kind}/deleted`), { id: 'deleted', deleted: true });
        await setDoc(doc(db, `trees/orphan/${kind}/active`), { id: 'active' });
      }
    });
  });

  it('allows owners, editors, viewers and legacy invitees to read private records', async () => {
    for (const [uid, email] of [['owner', 'owner@example.com'], ['editor', editorEmail],
      ['viewer', viewerEmail], ['legacy', 'legacy@example.com']]) {
      const db = database(uid, email);
      await assertSucceeds(getDoc(doc(db, 'trees/private')));
      for (const kind of ['people', 'unions']) {
        await assertSucceeds(getDoc(doc(db, `trees/private/${kind}/active`)));
        await assertSucceeds(getDocs(collection(db, `trees/private/${kind}`)));
      }
    }
  });

  it('denies private reads to strangers and unauthenticated visitors, including missing children', async () => {
    for (const uid of ['stranger', null]) {
      const db = database(uid);
      await assertFails(getDoc(doc(db, 'trees/private')));
      for (const kind of ['people', 'unions']) {
        for (const path of [`trees/private/${kind}/active`, `trees/private/${kind}/missing`,
          `trees/orphan/${kind}/active`]) {
          await assertFails(getDoc(doc(db, path)));
        }
        await assertFails(setDoc(doc(db, `trees/orphan/${kind}/new`), { id: 'new' }));
      }
    }
    await assertSucceeds(getDoc(doc(database(null), 'trees/missing')));
  });

  it('preserves owner and shared-email list queries', async () => {
    await assertSucceeds(getDocs(query(collection(database('owner'), 'trees'), where('ownerId', '==', 'owner'))));
    await assertSucceeds(getDocs(query(collection(database('viewer', viewerEmail), 'trees'),
      where('sharedEmails', 'array-contains', viewerEmail))));
  });

  it('keeps viewers and legacy invitations read-only, including public editor trees', async () => {
    for (const [uid, email] of [['viewer', viewerEmail], ['legacy', 'legacy@example.com']]) {
      const db = database(uid, email);
      for (const tree of ['private', 'public-editor']) {
        await assertFails(updateDoc(doc(db, `trees/${tree}`), { name: 'Changed' }));
        await assertFails(deleteDoc(doc(db, `trees/${tree}`)));
        for (const kind of ['people', 'unions']) {
          await assertFails(setDoc(doc(db, `trees/${tree}/${kind}/new`), { id: 'new' }));
        }
      }
      for (const kind of ['people', 'unions']) {
        await assertFails(updateDoc(doc(db, `trees/private/${kind}/active`), { deleted: true }));
        await assertFails(deleteDoc(doc(db, `trees/private/${kind}/deleted`)));
      }
    }
  });

  it('allows editors to change content and create records, but not hard-delete active records', async () => {
    for (const [uid, email] of [['owner', 'owner@example.com'], ['editor', editorEmail]]) {
      const db = database(uid, email);
      await assertSucceeds(updateDoc(doc(db, 'trees/private'), {
        name: 'Updated', people: { p: { id: 'p' } }, unions: {}, storageMode: 'subcollections',
        schemaVersion: 1, version: 2, updatedAt: '2026-09-30', layoutOverrides: {},
      }));
      for (const kind of ['people', 'unions']) {
        await assertSucceeds(setDoc(doc(db, `trees/private/${kind}/new-${uid}`), { id: `new-${uid}` }));
        await assertSucceeds(updateDoc(doc(db, `trees/private/${kind}/active`), { rev: 2 }));
      }
    }
    for (const kind of ['people', 'unions']) {
      const db = database('editor', editorEmail);
      await assertFails(deleteDoc(doc(db, `trees/private/${kind}/active`)));
      await assertSucceeds(deleteDoc(doc(db, `trees/private/${kind}/deleted`)));
      await assertSucceeds(deleteDoc(doc(database('owner'), `trees/private/${kind}/active`)));
    }
  });

  it('blocks editor changes, additions and removals of protected metadata', async () => {
    const changes = {
      ownerId: 'editor', ownerEmail: 'fake@example.com', ownerDisplayName: 'Fake', ownerPhotoURL: 'fake',
      sharedEmails: ['attacker@example.com'], sharedWith: {}, isPublic: true, publicRole: 'editor',
      unexpectedPermissionField: true,
    };
    for (const [key, value] of Object.entries(changes)) {
      await assertFails(updateDoc(root('editor', editorEmail), { [key]: value }));
      // Deleting an absent field is a no-op, not an authorization change.
      if (key in metadata) {
        await assertFails(updateDoc(root('editor', editorEmail), { [key]: deleteField() }));
      }
    }
    await assertFails(setDoc(root('editor', editorEmail), { ...metadata, sharedWith: {} }));
    await assertFails(deleteDoc(root('editor', editorEmail)));
    const publicRoot = doc(database('stranger'), 'trees/public-editor');
    await assertFails(updateDoc(publicRoot, { sharedEmails: ['attacker@example.com'] }));
    await assertFails(updateDoc(publicRoot, { publicRole: 'viewer' }));
  });

  it('allows only owners to manage sharing and rejects ownership transfers', async () => {
    await assertSucceeds(updateDoc(root('owner'), { isPublic: true, publicRole: 'editor', sharedWith: {}, sharedEmails: [] }));
    await assertFails(updateDoc(root('owner'), { ownerId: 'someone-else' }));
    await assertSucceeds(deleteDoc(root('owner')));
    await assertSucceeds(setDoc(doc(database('owner'), 'trees/new'), { ownerId: 'owner' }));
    await assertFails(setDoc(doc(database('stranger'), 'trees/spoof'), { ownerId: 'owner' }));
    await assertFails(setDoc(doc(database(null), 'trees/anonymous'), { ownerId: 'anonymous' }));
  });

  it('supports public reads without sharing fields and requires authentication for public writes', async () => {
    const anonymous = database(null);
    await assertSucceeds(getDoc(doc(anonymous, 'trees/no-sharing-fields')));
    await assertSucceeds(getDoc(doc(anonymous, 'trees/public-viewer')));
    await assertSucceeds(getDoc(doc(anonymous, 'trees/public-editor/people/missing')));
    await assertFails(updateDoc(doc(anonymous, 'trees/public-editor'), { name: 'No auth' }));
    await assertSucceeds(updateDoc(doc(database('anonymous-auth'), 'trees/public-editor'), { name: 'Allowed' }));
    for (const kind of ['people', 'unions']) {
      await assertFails(setDoc(doc(anonymous, `trees/public-editor/${kind}/new`), { id: 'new' }));
      await assertSucceeds(setDoc(doc(database('anonymous-auth'), `trees/public-editor/${kind}/new`), { id: 'new' }));
      await assertSucceeds(deleteDoc(doc(database('owner'), `trees/public-editor/${kind}/new`)));
    }
    await assertFails(updateDoc(doc(database('stranger'), 'trees/public-viewer'), { name: 'Denied' }));
  });

  it('uses current permissions after an owner downgrades or revokes an invitation', async () => {
    const editorRoot = root('editor', editorEmail);
    await assertSucceeds(updateDoc(editorRoot, { name: 'Before downgrade' }));
    await assertSucceeds(updateDoc(root('owner'), {
      [`sharedWith.${encodeEmailKey(editorEmail)}.role`]: 'viewer',
    }));
    await assertSucceeds(getDoc(editorRoot));
    await assertFails(updateDoc(editorRoot, { name: 'After downgrade' }));
    await assertSucceeds(updateDoc(root('owner'), {
      [`sharedWith.${encodeEmailKey(editorEmail)}`]: deleteField(),
      sharedEmails: [viewerEmail, 'legacy@example.com'],
    }));
    await assertFails(getDoc(editorRoot));
    await assertFails(setDoc(doc(database('editor', editorEmail), 'trees/private/people/new'), { id: 'new' }));
  });

  it('enforces real shape validators for person and union writes and tombstones', async () => {
    const db = database('editor', editorEmail);
    await assertFails(setDoc(doc(db, 'trees/private/people/new'), { id: 'wrong' }));
    await assertFails(setDoc(doc(db, 'trees/private/people/new'), { id: 'new', gender: 'robot' }));
    await assertFails(setDoc(doc(db, 'trees/private/unions/new'), { id: 'new', childrenIds: 'bad' }));
    for (const kind of ['people', 'unions']) {
      await assertSucceeds(setDoc(doc(db, `trees/private/${kind}/new`), { id: 'new', deleted: true }));
      await assertSucceeds(deleteDoc(doc(db, `trees/private/${kind}/new`)));
    }
  });
});