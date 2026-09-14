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
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import type {
  TreeData,
  CloudTreeData,
  CloudTreeMetadata,
  CloudTreeSummary,
  SharingSettings,
  UserPermission,
  ShareRole,
} from '../types/tree';
import { sanitizeTree } from './treeOperations';

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

/**
 * Updates only the tree content (people, unions, name, etc.) in Cloud Firestore.
 * Crucially leaves ownership, owner metadata, and sharing settings untouched.
 */
export async function updateCloudTreeData(tree: TreeData): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !tree?.id) {
    throw new Error('Firebase is not configured or tree ID is missing.');
  }

  const sanitized = sanitizeTree(tree);
  const docRef = doc(db, TREES_COLLECTION, sanitized.id);
  const now = new Date().toISOString();

  const contentUpdate = cleanForFirestore({
    name: sanitized.name,
    description: sanitized.description || '',
    rootPersonId: sanitized.rootPersonId || null,
    collapsedPersonIds: sanitized.collapsedPersonIds || [],
    people: sanitized.people,
    unions: sanitized.unions,
    updatedAt: now,
  });

  try {
    await withTimeout(
      updateDoc(docRef, contentUpdate),
      7000,
      'Connection to Cloud Firestore timed out (7s).'
    );
  } catch (err: any) {
    console.error(`Failed to update cloud tree ${sanitized.id}:`, err);
    throw new Error(formatFirestoreError(err));
  }
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

  // Preserve existing metadata if not explicitly provided
  const metadata: CloudTreeMetadata = {
    ownerId: existingMetadata?.ownerId || treeAny.ownerId || user.uid,
    ownerEmail: existingMetadata?.ownerEmail || treeAny.ownerEmail || normalizeEmail(user.email || ''),
    ownerDisplayName: existingMetadata?.ownerDisplayName || treeAny.ownerDisplayName || user.displayName || 'Anonymous',
    ownerPhotoURL: existingMetadata?.ownerPhotoURL || treeAny.ownerPhotoURL || user.photoURL || '',
    isPublic: existingMetadata?.isPublic ?? treeAny.isPublic ?? false,
    publicRole: existingMetadata?.publicRole || treeAny.publicRole || 'viewer',
    sharedWith: existingMetadata?.sharedWith || treeAny.sharedWith || {},
    sharedEmails: existingMetadata?.sharedEmails || treeAny.sharedEmails || [],
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
      return {
        ...sanitizeTree(data),
        ownerId: data.ownerId,
        ownerEmail: data.ownerEmail,
        ownerDisplayName: data.ownerDisplayName,
        ownerPhotoURL: data.ownerPhotoURL,
        isPublic: data.isPublic ?? false,
        publicRole: data.publicRole || 'viewer',
        sharedWith: data.sharedWith || {},
        sharedEmails: data.sharedEmails || [],
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
 * Deletes a cloud tree from Firestore.
 */
export async function deleteCloudTree(treeId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !treeId) return;

  const docRef = doc(db, TREES_COLLECTION, treeId);
  await deleteDoc(docRef);
}
