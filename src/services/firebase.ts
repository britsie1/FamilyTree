import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export interface FirebaseDiagnostics {
  isConfigured: boolean;
  projectId: string;
  rawProjectId: string;
  isProjectIdAppIdFormat: boolean;
  wasAutoCorrected: boolean;
  missingRequired: string[];
  presentKeys: string[];
}

function cleanValue(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

/**
 * Extracts the Project ID from an auth domain, web app host, or storage bucket.
 * e.g. "my-project-123.firebaseapp.com" -> "my-project-123"
 */
function extractProjectIdFromDomain(domain?: string): string | null {
  if (!domain) return null;
  const clean = cleanValue(domain).toLowerCase();
  const match = clean.match(/^([a-z0-9-]+)\.(firebaseapp\.com|web\.app|appspot\.com|firebasestorage\.app)$/i);
  return match ? match[1] : null;
}

/**
 * Checks if a value looks like a Firebase Web App ID (e.g. 1:123456789:web:abcdef)
 * or literal placeholder text, rather than a valid Google Cloud Project ID.
 */
function isAppIdFormat(val: string): boolean {
  if (!val) return false;
  const clean = cleanValue(val);
  return clean.includes(':') || clean.startsWith('1:') || clean.toLowerCase().includes('app id');
}

function getEnvVar(key: string): string {
  try {
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    if (metaEnv && typeof metaEnv === 'object') {
      if (metaEnv[key]) return cleanValue(metaEnv[key]);
      const noPrefix = key.replace('VITE_', '');
      if (metaEnv[noPrefix]) return cleanValue(metaEnv[noPrefix]);
    }
    const proc = (globalThis as any).process;
    if (proc && proc.env && typeof proc.env === 'object') {
      if (proc.env[key]) return cleanValue(proc.env[key]);
      const noPrefix = key.replace('VITE_', '');
      if (proc.env[noPrefix]) return cleanValue(proc.env[noPrefix]);
    }
  } catch {
    // Ignore environment access errors
  }
  return '';
}

/**
 * Checks if a single JSON config was provided (e.g. pasted into VITE_FIREBASE_CONFIG or FIREBASE_CONFIG)
 */
function getJsonConfig(): Partial<FirebaseConfig> | null {
  const raw = getEnvVar('VITE_FIREBASE_CONFIG');

  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object') {
      return {
        apiKey: cleanValue(parsed.apiKey),
        authDomain: cleanValue(parsed.authDomain),
        projectId: cleanValue(parsed.projectId),
        storageBucket: cleanValue(parsed.storageBucket),
        messagingSenderId: cleanValue(parsed.messagingSenderId),
        appId: cleanValue(parsed.appId),
      };
    }
  } catch {
    // Ignore JSON parse errors
  }
  return null;
}

/**
 * Loads Firebase configuration from environment variables.
 * Supports VITE_FIREBASE_*, FIREBASE_*, or JSON configs.
 * Automatically heals cases where App ID was mistakenly placed in VITE_FIREBASE_PROJECT_ID.
 */
export function getFirebaseConfig(): FirebaseConfig | null {
  const json = getJsonConfig();

  const apiKey = cleanValue(
    json?.apiKey || getEnvVar('VITE_FIREBASE_API_KEY')
  );

  const authDomain = cleanValue(
    json?.authDomain || getEnvVar('VITE_FIREBASE_AUTH_DOMAIN')
  );

  const rawProjectId = cleanValue(
    json?.projectId || getEnvVar('VITE_FIREBASE_PROJECT_ID')
  );

  const storageBucket = cleanValue(
    json?.storageBucket || getEnvVar('VITE_FIREBASE_STORAGE_BUCKET')
  );

  const messagingSenderId = cleanValue(
    json?.messagingSenderId || getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID')
  );

  const rawAppId = cleanValue(
    json?.appId || getEnvVar('VITE_FIREBASE_APP_ID')
  );

  let projectId = rawProjectId;
  let appId = rawAppId;

  // Auto-heal: If rawProjectId is formatted like an App ID (e.g. contains colons or starts with 1:)
  if (isAppIdFormat(rawProjectId)) {
    // 1. Check if rawAppId was actually the Project ID (swapped variables)
    if (rawAppId && !isAppIdFormat(rawAppId)) {
      projectId = rawAppId;
      appId = rawProjectId;
    } else {
      // 2. Try extracting true project ID from authDomain or storageBucket
      const fromAuth = extractProjectIdFromDomain(authDomain);
      const fromBucket = extractProjectIdFromDomain(storageBucket);
      if (fromAuth) {
        projectId = fromAuth;
      } else if (fromBucket) {
        projectId = fromBucket;
      }
    }
  }

  const config: FirebaseConfig = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };

  if (config.apiKey && config.projectId && config.apiKey !== 'your-api-key-here') {
    return config;
  }

  return null;
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}

export function getFirebaseDiagnostics(): FirebaseDiagnostics {
  const config = getFirebaseConfig();
  const rawProject = getEnvVar('VITE_FIREBASE_PROJECT_ID');

  const isAppId = isAppIdFormat(rawProject);
  const wasCorrected = Boolean(config && isAppId && config.projectId !== rawProject);

  if (config) {
    const present = Object.entries(config)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k);
    return {
      isConfigured: true,
      projectId: config.projectId,
      rawProjectId: rawProject,
      isProjectIdAppIdFormat: isAppId,
      wasAutoCorrected: wasCorrected,
      missingRequired: [],
      presentKeys: present,
    };
  }

  const missing: string[] = [];
  const present: string[] = [];

  const checkKey = (keyName: string, label: string) => {
    const val = getEnvVar(keyName);
    if (!val || val === 'your-api-key-here') {
      missing.push(label);
    } else {
      present.push(label);
    }
  };

  checkKey('VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY');
  checkKey('VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID');
  checkKey('VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN');
  checkKey('VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID');

  return {
    isConfigured: false,
    projectId: rawProject,
    rawProjectId: rawProject,
    isProjectIdAppIdFormat: isAppId,
    wasAutoCorrected: false,
    missingRequired: missing,
    presentKeys: present,
  };
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (cachedApp) return cachedApp;
  const config = getFirebaseConfig();
  if (!config) return null;

  try {
    const apps = getApps();
    if (apps.length > 0) {
      cachedApp = apps[0];
    } else {
      cachedApp = initializeApp(config);
    }
    return cachedApp;
  } catch (err) {
    console.error('Failed to initialize Firebase App:', err);
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  if (cachedAuth) return cachedAuth;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (err) {
    console.error('Failed to get Firebase Auth:', err);
    return null;
  }
}

export function getFirebaseDb(): Firestore | null {
  if (cachedDb) return cachedDb;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    cachedDb = getFirestore(app);
    return cachedDb;
  } catch (err) {
    console.error('Failed to get Firestore DB:', err);
    return null;
  }
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
