import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  writeBatch,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import type {
  TreeData,
  Person,
  Union,
  CloudTreeData,
  CloudTreeMetadata,
  CloudTreeSummary,
  SharingSettings,
  UserPermission,
  ShareRole,
  GoogleDriveConfig,
} from '../types/tree';
import { sanitizeTree } from './treeOperations';
import { generateId, isPresetTreeId } from './storage';
import { threeWayMergeTree } from './treeMerge';

export const RECOMMENDED_FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner() {
      return isAuthenticated() && resource != null && resource.data.ownerId == request.auth.uid;
    }

    function isPublic() {
      return resource != null && resource.data.get('isPublic', false) == true;
    }

    function isPublicEditor() {
      return isPublic() && resource.data.get('publicRole', 'viewer') == 'editor';
    }

    function isInvitedCollaborator() {
      return isAuthenticated() &&
             request.auth.token.email != null &&
             resource != null &&
             ('sharedEmails' in resource.data) &&
             request.auth.token.email.lower() in resource.data.sharedEmails;
    }

    // Rules for family tree documents
    match /trees/{treeId} {
      // Anyone can read if document does not exist yet (to allow checking existence),
      // or if tree is public, or if owner, or if invited email
      allow read: if resource == null || isPublic() || isOwner() || isInvitedCollaborator();

      // Authenticated users can create new trees with themselves as owner
      allow create: if isAuthenticated() &&
                       request.resource.data.ownerId == request.auth.uid;

      // Update allowed by owner, public editor, or invited collaborator
      allow update: if (
                       // 1. Owner can update tree and settings
                       isOwner()
                    ) || (
                       // 2. Public editor (including guest) can update tree data,
                       // but cannot change ownership or general access settings
                       isPublicEditor() &&
                       request.resource.data.ownerId == resource.data.ownerId &&
                       request.resource.data.get('isPublic', false) == resource.data.get('isPublic', false) &&
                       request.resource.data.get('publicRole', 'viewer') == resource.data.get('publicRole', 'viewer')
                    ) || (
                       // 3. Invited collaborator can update tree data, but cannot change ownership
                       isInvitedCollaborator() &&
                       request.resource.data.ownerId == resource.data.ownerId &&
                       request.resource.data.get('isPublic', false) == resource.data.get('isPublic', false)
                    );

      // Delete allowed only by owner
      allow delete: if isOwner();

      // Subcollection for individual people documents
      match /people/{personId} {
        allow read: if resource == null ||
                       get(/databases/$(database)/documents/trees/$(treeId)).data.get('isPublic', false) == true ||
                       get(/databases/$(database)/documents/trees/$(treeId)).data.ownerId == request.auth.uid ||
                       (isAuthenticated() && request.auth.token.email != null &&
                        request.auth.token.email.lower() in get(/databases/$(database)/documents/trees/$(treeId)).data.sharedEmails);

        allow create, update: if isAuthenticated() && (
          get(/databases/$(database)/documents/trees/$(treeId)).data.ownerId == request.auth.uid ||
          (get(/databases/$(database)/documents/trees/$(treeId)).data.get('isPublic', false) == true &&
           get(/databases/$(database)/documents/trees/$(treeId)).data.get('publicRole', 'viewer') == 'editor') ||
          (request.auth.token.email != null &&
           request.auth.token.email.lower() in get(/databases/$(database)/documents/trees/$(treeId)).data.sharedEmails)
        );

        allow delete: if isAuthenticated() &&
          get(/databases/$(database)/documents/trees/$(treeId)).data.ownerId == request.auth.uid;
      }
    }
  }
}`;

const TREES_COLLECTION = 'trees';

/**
 * Normalizes email address for consistent matching.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Escapes email address so it is safe to use as a nested Firestore map key.
 */
export function encodeEmailKey(email: string): string {
  return normalizeEmail(email)
    .replace(/%/g, '%25')
    .replace(/\./g, '%2E')
    .replace(/@/g, '%40')
    .replace(/\//g, '%2F');
}

/**
 * Decodes the encoded email key back to a standard email address.
 */
export function decodeEmailKey(key: string): string {
  return decodeURIComponent(key);
}

/**
 * Resolves user's effective permission for a given cloud tree.
 */
export function resolveUserPermission(
  tree: CloudTreeMetadata | CloudTreeData,
  user: { uid: string; email?: string | null } | null
): UserPermission {
  // 1. Owner has full permissions
  if (user && tree.ownerId && tree.ownerId === user.uid) {
    return 'owner';
  }

  // 2. Check if user is in closed shared email list
  if (user?.email) {
    const userEmail = normalizeEmail(user.email);
    const encodedKey = encodeEmailKey(userEmail);

    // Direct check in sharedWith map
    if (tree.sharedWith && tree.sharedWith[encodedKey]) {
      return tree.sharedWith[encodedKey].role;
    }

    // Fallback check by traversing sharedWith
    if (tree.sharedWith) {
      for (const entry of Object.values(tree.sharedWith)) {
        if (normalizeEmail(entry.email) === userEmail) {
          return entry.role;
        }
      }
    }
  }

  // 3. Check general public link access
  if (tree.isPublic) {
    return tree.publicRole || 'viewer';
  }

  // 4. Access Denied
  return 'none';
}

/**
 * Recursively cleanses an object of any `undefined` values before writing to Firestore.
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        result[key] = cleanForFirestore(val);
      }
    }
    return result as T;
  }
  return data;
}

/**
 * Transforms cryptic Firebase / Firestore error messages into actionable user guidance.
 */
export function formatFirestoreError(err: any): string {
  const msg = err?.message || String(err || 'Unknown error');

  if (msg.includes('client is offline') || err?.code === 'unavailable') {
    return (
      'Unable to connect to Cloud Firestore (client is offline or blocked). Please verify: 1) A Firestore Database is created in Firebase Console (Build > Firestore Database) using Native mode and (default) database ID; 2) Firestore Rules are published; 3) No browser ad-blocker/extension is blocking firestore.googleapis.com.'
    );
  }

  if (err?.code === 'permission-denied' || msg.includes('permission') || msg.includes('insufficient permissions')) {
    return (
      'Firestore permission denied. Please verify your Firestore Security Rules in Firebase Console > Build > Firestore Database > Rules.'
    );
  }

  return msg;
}

/**
 * Wraps a promise in a timeout to prevent indefinite hangs when network is blocked.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 7000,
  errorMsg = 'Firestore operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    ),
  ]);
}

export const FIRESTORE_MAX_DOC_BYTES = 1048576; // 1 MB Firestore document limit
export const FIRESTORE_WARN_DOC_BYTES = 800 * 1024; // 800 KB threshold to recommend subcollection migration

export class ConcurrencyConflictError extends Error {
  public readonly serverVersion: number;
  public readonly baseVersion: number;
  public readonly conflicts: any[];

  constructor(message: string, serverVersion: number, baseVersion: number, conflicts: any[] = []) {
    super(message);
    this.name = 'ConcurrencyConflictError';
    this.serverVersion = serverVersion;
    this.baseVersion = baseVersion;
    this.conflicts = conflicts;
  }
}

/**
 * Estimates the document size in bytes as stored in Firestore JSON format.
 */
export function estimateTreeDocumentSize(data: any): number {
  if (!data) return 0;
  try {
    const cleaned = cleanForFirestore(data);
    const json = JSON.stringify(cleaned || {});
    return new TextEncoder().encode(json).length;
  } catch {
    return 0;
  }
}

/**
 * Updates only the tree content (people, unions, name, etc.) in Cloud Firestore.
 * Crucially leaves ownership, owner metadata, and sharing settings untouched.
 * Supports optimistic concurrency control via baseVersion and subcollections storage.
 */
export async function updateCloudTreeData(
  tree: TreeData,
  options?: { baseVersion?: number }
): Promise<{ version: number }> {
  const db = getFirebaseDb();
  if (!db || !tree?.id) {
    throw new Error('Firebase is not configured or tree ID is missing.');
  }

  const sanitized = sanitizeTree(tree);
  const docRef = doc(db, TREES_COLLECTION, sanitized.id);
  const now = new Date().toISOString();

  // Check document size threshold for monolithic storage
  if (sanitized.storageMode !== 'subcollections') {
    const size = estimateTreeDocumentSize(sanitized);
    if (size > FIRESTORE_WARN_DOC_BYTES) {
      console.warn(
        `Tree document size (${Math.round(size / 1024)} KB) is approaching Firestore 1 MB limit (${Math.round(FIRESTORE_MAX_DOC_BYTES / 1024)} KB). Consider migrating to subcollections via migrateTreeToSubcollections().`
      );
    }
  }

  const contentUpdate = cleanForFirestore({
    name: sanitized.name,
    description: sanitized.description || '',
    rootPersonId: sanitized.rootPersonId || null,
    collapsedPersonIds: sanitized.collapsedPersonIds || [],
    people: sanitized.storageMode === 'subcollections' ? {} : sanitized.people,
    unions: sanitized.unions,
    googleDriveConfig: sanitized.googleDriveConfig || null,
    storageMode: sanitized.storageMode || 'monolithic',
    updatedAt: now,
  });

  try {
    if (options?.baseVersion !== undefined) {
      const expectedVersion = options.baseVersion;
      const newVersion = await withTimeout(
        runTransaction(db, async (transaction) => {
          const snap = await transaction.get(docRef);
          if (!snap.exists()) throw new Error(`Tree ${sanitized.id} not found.`);
          const serverData = snap.data() as CloudTreeData;
          const serverVersion = serverData.version || 1;

          if (serverVersion !== expectedVersion) {
            // Attempt 3-way merge of non-conflicting keys
            const mergeResult = threeWayMergeTree(
              { ...sanitized, version: expectedVersion },
              sanitized,
              serverData
            );
            if (mergeResult.hasConflict) {
              throw new ConcurrencyConflictError(
                `Concurrency conflict: tree was modified remotely (v${serverVersion} vs local base v${expectedVersion}).`,
                serverVersion,
                expectedVersion,
                mergeResult.conflicts
              );
            }
            const nextVersion = serverVersion + 1;
            const mergedPayload = cleanForFirestore({
              ...contentUpdate,
              name: mergeResult.merged.name,
              description: mergeResult.merged.description || '',
              people: sanitized.storageMode === 'subcollections' ? {} : mergeResult.merged.people,
              unions: mergeResult.merged.unions,
              version: nextVersion,
              updatedAt: now,
            });
            transaction.update(docRef, mergedPayload);
            return nextVersion;
          }

          const nextVersion = serverVersion + 1;
          transaction.update(docRef, {
            ...contentUpdate,
            version: nextVersion,
          });
          return nextVersion;
        }),
        7000,
        'Connection to Cloud Firestore timed out (7s).'
      );
      return { version: newVersion };
    } else {
      const nextVersion = (sanitized.version || 1) + 1;
      await withTimeout(
        updateDoc(docRef, { ...contentUpdate, version: nextVersion }),
        7000,
        'Connection to Cloud Firestore timed out (7s).'
      );
      return { version: nextVersion };
    }
  } catch (err: any) {
    if (err instanceof ConcurrencyConflictError) {
      throw err;
    }
    console.error(`Failed to update cloud tree ${sanitized.id}:`, err);
    throw new Error(formatFirestoreError(err));
  }
}

/**
 * Granularly patches a single person in Firestore without overwriting the entire tree.
 * Supports targeted field-path updates, subcollection routing, and optimistic concurrency control.
 */
export async function patchCloudPerson(
  treeId: string,
  personId: string,
  updates: Partial<Person>,
  options?: { baseVersion?: number; isSubcollection?: boolean }
): Promise<{ version: number }> {
  const db = getFirebaseDb();
  if (!db || !treeId) {
    throw new Error('Firebase is not configured or tree ID is missing.');
  }

  const cleaned = cleanForFirestore(updates) as Record<string, any>;
  const now = new Date().toISOString();

  // If subcollection storage is enabled
  if (options?.isSubcollection) {
    const personDocRef = doc(db, TREES_COLLECTION, treeId, 'people', personId);
    try {
      await withTimeout(
        setDoc(personDocRef, { ...cleaned, id: personId }, { merge: true }),
        7000,
        'Connection to Cloud Firestore timed out.'
      );
      const rootDocRef = doc(db, TREES_COLLECTION, treeId);
      await withTimeout(
        updateDoc(rootDocRef, { updatedAt: now }),
        7000,
        'Connection to Cloud Firestore timed out.'
      );
      return { version: (options.baseVersion || 1) + 1 };
    } catch (err: any) {
      console.error(`Failed to patch subcollection person ${personId}:`, err);
      throw new Error(formatFirestoreError(err));
    }
  }

  // Monolithic storage
  const docRef = doc(db, TREES_COLLECTION, treeId);

  try {
    if (options?.baseVersion !== undefined) {
      const expectedVersion = options.baseVersion;
      const newVersion = await withTimeout(
        runTransaction(db, async (transaction) => {
          const snap = await transaction.get(docRef);
          if (!snap.exists()) throw new Error(`Tree ${treeId} does not exist.`);
          const serverData = snap.data() as CloudTreeData;
          const serverVersion = serverData.version || 1;

          if (serverVersion !== expectedVersion) {
            // Concurrency check: check if the fields we are modifying collided
            const serverPerson = serverData.people?.[personId];
            if (serverPerson) {
              const collidingKeys = Object.keys(cleaned).filter(
                (k) => (serverPerson as any)[k] !== undefined && (serverPerson as any)[k] !== cleaned[k]
              );
              if (collidingKeys.length > 0) {
                throw new ConcurrencyConflictError(
                  `Conflict on person ${personId} (fields: ${collidingKeys.join(', ')}). Remote version is ${serverVersion}, base version was ${expectedVersion}.`,
                  serverVersion,
                  expectedVersion,
                  collidingKeys
                );
              }
            }
          }

          const nextVersion = serverVersion + 1;
          const payload: Record<string, any> = {
            updatedAt: now,
            version: nextVersion,
          };
          for (const [key, val] of Object.entries(cleaned)) {
            payload[`people.${personId}.${key}`] = val;
          }
          transaction.update(docRef, payload);
          return nextVersion;
        }),
        7000,
        'Connection to Cloud Firestore timed out.'
      );
      return { version: newVersion };
    } else {
      const payload: Record<string, any> = {
        updatedAt: now,
      };
      for (const [key, val] of Object.entries(cleaned)) {
        payload[`people.${personId}.${key}`] = val;
      }
      await withTimeout(
        updateDoc(docRef, payload),
        7000,
        'Connection to Cloud Firestore timed out.'
      );
      return { version: 1 };
    }
  } catch (err: any) {
    if (err instanceof ConcurrencyConflictError) {
      throw err;
    }
    console.error(`Failed to patch cloud person ${personId}:`, err);
    throw new Error(formatFirestoreError(err));
  }
}

/**
 * Granularly patches a single union in Firestore without overwriting the entire tree.
 * Supports targeted field-path updates and optimistic concurrency control.
 */
export async function patchCloudUnion(
  treeId: string,
  unionId: string,
  updates: Partial<Union>,
  options?: { baseVersion?: number }
): Promise<{ version: number }> {
  const db = getFirebaseDb();
  if (!db || !treeId) {
    throw new Error('Firebase is not configured or tree ID is missing.');
  }

  const docRef = doc(db, TREES_COLLECTION, treeId);
  const now = new Date().toISOString();
  const cleaned = cleanForFirestore(updates) as Record<string, any>;

  try {
    if (options?.baseVersion !== undefined) {
      const expectedVersion = options.baseVersion;
      const newVersion = await withTimeout(
        runTransaction(db, async (transaction) => {
          const snap = await transaction.get(docRef);
          if (!snap.exists()) throw new Error(`Tree ${treeId} does not exist.`);
          const serverData = snap.data() as CloudTreeData;
          const serverVersion = serverData.version || 1;

          if (serverVersion !== expectedVersion) {
            const serverUnion = serverData.unions?.[unionId];
            if (serverUnion) {
              const collidingKeys = Object.keys(cleaned).filter(
                (k) => (serverUnion as any)[k] !== undefined && (serverUnion as any)[k] !== cleaned[k]
              );
              if (collidingKeys.length > 0) {
                throw new ConcurrencyConflictError(
                  `Conflict on union ${unionId} (fields: ${collidingKeys.join(', ')}). Remote version is ${serverVersion}, base version was ${expectedVersion}.`,
                  serverVersion,
                  expectedVersion,
                  collidingKeys
                );
              }
            }
          }

          const nextVersion = serverVersion + 1;
          const payload: Record<string, any> = {
            updatedAt: now,
            version: nextVersion,
          };
          for (const [key, val] of Object.entries(cleaned)) {
            payload[`unions.${unionId}.${key}`] = val;
          }
          transaction.update(docRef, payload);
          return nextVersion;
        }),
        7000,
        'Connection to Cloud Firestore timed out.'
      );
      return { version: newVersion };
    } else {
      const payload: Record<string, any> = {
        updatedAt: now,
      };
      for (const [key, val] of Object.entries(cleaned)) {
        payload[`unions.${unionId}.${key}`] = val;
      }
      await withTimeout(
        updateDoc(docRef, payload),
        7000,
        'Connection to Cloud Firestore timed out.'
      );
      return { version: 1 };
    }
  } catch (err: any) {
    if (err instanceof ConcurrencyConflictError) {
      throw err;
    }
    console.error(`Failed to patch cloud union ${unionId}:`, err);
    throw new Error(formatFirestoreError(err));
  }
}

/**
 * Migrates a monolithic family tree to Firestore subcollections (trees/{treeId}/people/{personId}).
 * Strips the large people map from the root document to guarantee it never breaches the 1 MB limit.
 */
export async function migrateTreeToSubcollections(
  treeId: string
): Promise<{ migratedPeopleCount: number }> {
  const db = getFirebaseDb();
  if (!db || !treeId) {
    throw new Error('Firebase is not configured or tree ID is missing.');
  }

  const docRef = doc(db, TREES_COLLECTION, treeId);
  const snap = await withTimeout(
    getDoc(docRef),
    7000,
    'Connection to Cloud Firestore timed out.'
  );

  if (!snap.exists()) {
    throw new Error(`Tree ${treeId} does not exist in Cloud Firestore.`);
  }

  const data = snap.data() as CloudTreeData;
  const people = data.people || {};
  const peopleEntries = Object.entries(people);

  if (peopleEntries.length === 0) {
    return { migratedPeopleCount: 0 };
  }

  // Write in chunks of up to 400 (Firestore limit is 500 ops per batch)
  const batchSize = 400;
  for (let i = 0; i < peopleEntries.length; i += batchSize) {
    const chunk = peopleEntries.slice(i, i + batchSize);
    const batch = writeBatch(db);
    for (const [pId, person] of chunk) {
      const pDocRef = doc(db, TREES_COLLECTION, treeId, 'people', pId);
      batch.set(pDocRef, cleanForFirestore(person));
    }
    await withTimeout(batch.commit(), 7000, 'Failed to commit people subcollection batch.');
  }

  // Update root tree document: clear monolithic people map, set storageMode, and bump version
  const now = new Date().toISOString();
  const nextVersion = (data.version || 1) + 1;
  await withTimeout(
    updateDoc(docRef, {
      storageMode: 'subcollections',
      people: {},
      version: nextVersion,
      updatedAt: now,
    }),
    7000,
    'Failed to update root tree storageMode.'
  );

  return { migratedPeopleCount: peopleEntries.length };
}

/**
 * Saves or updates a tree in Firestore with metadata preservation.
 */
export async function saveTreeToCloud(
  tree: TreeData,
  user: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null },
  existingMetadata?: Partial<CloudTreeMetadata>
): Promise<CloudTreeData> {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error('Firebase is not configured. Please add your Firebase configuration.');
  }

  const now = new Date().toISOString();
  const sanitized = sanitizeTree(tree);
  const treeAny = tree as any;

  // Auto-heal preset ID collisions: Presets must not be saved under global static IDs
  if (isPresetTreeId(sanitized.id)) {
    const newId = generateId('tree');
    sanitized.id = newId;
    tree.id = newId;
  }

  // If this local tree has an ownerId from another user (e.g. from an import or copy),
  // fork a new tree ID so it doesn't try to overwrite another user's document
  if (!existingMetadata?.ownerId && treeAny.ownerId && treeAny.ownerId !== user.uid) {
    const forkedId = generateId('tree');
    sanitized.id = forkedId;
    tree.id = forkedId;
  }

  // Ensure owner is current user unless existingMetadata explicitly specifies ownerId
  const resolvedOwnerId = existingMetadata?.ownerId || user.uid;

  // Preserve existing metadata if not explicitly provided
  const metadata: CloudTreeMetadata = {
    ownerId: resolvedOwnerId,
    ownerEmail: existingMetadata?.ownerEmail || (treeAny.ownerEmail && resolvedOwnerId === treeAny.ownerId ? treeAny.ownerEmail : normalizeEmail(user.email || '')),
    ownerDisplayName: existingMetadata?.ownerDisplayName || (treeAny.ownerDisplayName && resolvedOwnerId === treeAny.ownerId ? treeAny.ownerDisplayName : (user.displayName || 'Anonymous')),
    ownerPhotoURL: existingMetadata?.ownerPhotoURL || (treeAny.ownerPhotoURL && resolvedOwnerId === treeAny.ownerId ? treeAny.ownerPhotoURL : (user.photoURL || '')),
    isPublic: existingMetadata?.isPublic ?? treeAny.isPublic ?? false,
    publicRole: existingMetadata?.publicRole || treeAny.publicRole || 'viewer',
    sharedWith: existingMetadata?.sharedWith || treeAny.sharedWith || {},
    sharedEmails: existingMetadata?.sharedEmails || treeAny.sharedEmails || [],
    googleDriveConfig: existingMetadata?.googleDriveConfig || treeAny.googleDriveConfig || undefined,
    version: existingMetadata?.version || treeAny.version || 1,
    storageMode: existingMetadata?.storageMode || treeAny.storageMode || 'monolithic',
  };

  const cloudTree: CloudTreeData = {
    ...sanitized,
    ...metadata,
    updatedAt: now,
  };

  try {
    const docRef = doc(db, TREES_COLLECTION, cloudTree.id);
    const cleanedData = cleanForFirestore(cloudTree);
    await withTimeout(
      setDoc(docRef, cleanedData),
      7000,
      'Connection to Cloud Firestore timed out (7s). Please check your internet connection or verify Firestore rules in Firebase Console.'
    );
    return cloudTree;
  } catch (err: any) {
    // If it's a permission error and tree ID might have collided with another user's document in Firestore,
    // automatically attempt recovery with a guaranteed unique ID
    const msg = err?.message || String(err || '');
    if (
      (err?.code === 'permission-denied' || msg.includes('permission') || msg.includes('insufficient permissions')) &&
      !cloudTree.id.startsWith('tree_u_')
    ) {
      try {
        const freshId = `tree_u_${generateId('tree')}`;
        cloudTree.id = freshId;
        tree.id = freshId;
        const freshDocRef = doc(db, TREES_COLLECTION, freshId);
        const cleanedData = cleanForFirestore(cloudTree);
        await withTimeout(
          setDoc(freshDocRef, cleanedData),
          7000,
          'Connection to Cloud Firestore timed out (7s).'
        );
        return cloudTree;
      } catch (retryErr) {
        console.warn('Auto-recovery with fresh ID also encountered error:', retryErr);
      }
    }
    console.error('Failed to save cloud tree:', err);
    throw new Error(formatFirestoreError(err));
  }
}

/**
 * Loads a tree document from Firestore by its ID.
 */
export async function getCloudTree(treeId: string): Promise<CloudTreeData | null> {
  const db = getFirebaseDb();
  if (!db || !treeId) return null;

  try {
    const docRef = doc(db, TREES_COLLECTION, treeId);
    const snap = await withTimeout(
      getDoc(docRef),
      7000,
      'Connection to Cloud Firestore timed out (7s).'
    );
    if (snap.exists()) {
      const data = snap.data() as CloudTreeData;
      let people = data.people || {};
      if (data.storageMode === 'subcollections') {
        try {
          const peopleSnap = await withTimeout(
            getDocs(collection(db, TREES_COLLECTION, treeId, 'people')),
            7000,
            'Loading subcollection people timed out.'
          );
          if (!peopleSnap.empty) {
            people = {};
            peopleSnap.forEach((pDoc) => {
              const pData = pDoc.data() as Person;
              people[pDoc.id] = { ...pData, id: pDoc.id };
            });
          }
        } catch (subErr) {
          console.warn(`Could not load people subcollection for tree ${treeId}:`, subErr);
        }
      }
      return {
        ...sanitizeTree({ ...data, people }),
        version: data.version || 1,
        storageMode: data.storageMode || 'monolithic',
        ownerId: data.ownerId,
        ownerEmail: data.ownerEmail,
        ownerDisplayName: data.ownerDisplayName,
        ownerPhotoURL: data.ownerPhotoURL,
        isPublic: data.isPublic ?? false,
        publicRole: data.publicRole || 'viewer',
        sharedWith: data.sharedWith || {},
        sharedEmails: data.sharedEmails || [],
        googleDriveConfig: data.googleDriveConfig,
      };
    }
    return null;
  } catch (err: any) {
    console.error(`Error loading cloud tree ${treeId}:`, err);
    throw new Error(formatFirestoreError(err));
  }
}

/**
 * Subscribes to real-time changes of a cloud tree.
 */
export function subscribeToCloudTree(
  treeId: string,
  onUpdate: (tree: CloudTreeData | null) => void,
  onError: (err: Error) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db || !treeId) return null;

  const docRef = doc(db, TREES_COLLECTION, treeId);
  return onSnapshot(
    docRef,
    (snap) => {
      // Ignore local writes that have not been acknowledged by the server
      if (snap.metadata.hasPendingWrites) {
        return;
      }
      if (snap.exists()) {
        const data = snap.data() as CloudTreeData;
        const parsed: CloudTreeData = {
          ...sanitizeTree(data),
          ownerId: data.ownerId,
          ownerEmail: data.ownerEmail,
          ownerDisplayName: data.ownerDisplayName,
          ownerPhotoURL: data.ownerPhotoURL,
          isPublic: data.isPublic ?? false,
          publicRole: data.publicRole || 'viewer',
          sharedWith: data.sharedWith || {},
          sharedEmails: data.sharedEmails || [],
          googleDriveConfig: data.googleDriveConfig,
        };
        onUpdate(parsed);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.error(`Realtime subscription error for tree ${treeId}:`, err);
      onError(err);
    }
  );
}

/**
 * Lists all cloud trees owned by the user.
 */
export async function listUserCloudTrees(user: { uid: string }): Promise<CloudTreeSummary[]> {
  const db = getFirebaseDb();
  if (!db || !user?.uid) return [];

  try {
    const q = query(collection(db, TREES_COLLECTION), where('ownerId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    const summaries: CloudTreeSummary[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      summaries.push({
        id: docSnap.id,
        name: data.name || 'Untitled Tree',
        updatedAt: data.updatedAt || new Date().toISOString(),
        ownerId: data.ownerId,
        ownerEmail: data.ownerEmail,
        ownerDisplayName: data.ownerDisplayName,
        role: 'owner',
        isPublic: Boolean(data.isPublic),
        peopleCount: data.people ? Object.keys(data.people).length : 0,
        unionCount: data.unions ? Object.keys(data.unions).length : 0,
      });
    });

    return summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (err) {
    console.error('Error listing user cloud trees:', err);
    return [];
  }
}

/**
 * Lists all cloud trees shared with the user's email address.
 */
export async function listSharedWithMeTrees(user: { email?: string | null; uid: string }): Promise<CloudTreeSummary[]> {
  const db = getFirebaseDb();
  if (!db || !user?.email) return [];

  try {
    const normEmail = normalizeEmail(user.email);
    const q = query(collection(db, TREES_COLLECTION), where('sharedEmails', 'array-contains', normEmail));
    const querySnapshot = await getDocs(q);
    const summaries: CloudTreeSummary[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Skip if current user happens to be the owner
      if (data.ownerId === user.uid) return;

      const encodedKey = encodeEmailKey(normEmail);
      const role: ShareRole = data.sharedWith?.[encodedKey]?.role || 'viewer';

      summaries.push({
        id: docSnap.id,
        name: data.name || 'Untitled Tree',
        updatedAt: data.updatedAt || new Date().toISOString(),
        ownerId: data.ownerId,
        ownerEmail: data.ownerEmail,
        ownerDisplayName: data.ownerDisplayName,
        role,
        isPublic: Boolean(data.isPublic),
        peopleCount: data.people ? Object.keys(data.people).length : 0,
        unionCount: data.unions ? Object.keys(data.unions).length : 0,
      });
    });

    return summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (err) {
    console.error('Error listing shared with me trees:', err);
    return [];
  }
}

/**
 * Updates the sharing settings (general access + invited email list) of a cloud tree.
 */
export async function updateTreeSharingSettings(
  treeId: string,
  settings: SharingSettings
): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !treeId) {
    throw new Error('Firebase is not available');
  }

  try {
    const docRef = doc(db, TREES_COLLECTION, treeId);
    const now = new Date().toISOString();

    await withTimeout(
      updateDoc(docRef, cleanForFirestore({
        isPublic: settings.isPublic,
        publicRole: settings.publicRole,
        sharedWith: settings.sharedWith,
        sharedEmails: settings.sharedEmails,
        updatedAt: now,
      })),
      7000,
      'Updating sharing settings timed out (7s).'
    );
  } catch (err: any) {
    console.error('Failed to update sharing settings:', err);
    throw new Error(formatFirestoreError(err));
  }
}

/**
 * Updates the Google Drive configuration of a cloud tree in Firestore.
 */
export async function updateCloudTreeGoogleDriveConfig(
  treeId: string,
  config: GoogleDriveConfig | null
): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !treeId) {
    throw new Error('Firebase is not available');
  }

  try {
    const docRef = doc(db, TREES_COLLECTION, treeId);
    const now = new Date().toISOString();

    await withTimeout(
      updateDoc(
        docRef,
        cleanForFirestore({
          googleDriveConfig: config || null,
          updatedAt: now,
        })
      ),
      7000,
      'Updating Google Drive settings timed out (7s).'
    );
  } catch (err: any) {
    console.error('Failed to update Google Drive configuration in cloud:', err);
    throw new Error(formatFirestoreError(err));
  }
}

/**
 * Deletes a cloud tree from Firestore.
 */
export async function deleteCloudTree(treeId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !treeId) return;

  const docRef = doc(db, TREES_COLLECTION, treeId);
  await deleteDoc(docRef);
}
