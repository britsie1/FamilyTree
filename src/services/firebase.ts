import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, type Firestore } from 'firebase/firestore';

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
  missingRequired: string[];
  presentKeys: string[];
}

function cleanValue(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

/**
 * Checks if a single JSON config was provided (e.g. pasted into VITE_FIREBASE_CONFIG or FIREBASE_CONFIG)
 */
function getJsonConfig(): Partial<FirebaseConfig> | null {
  const raw =
    (import.meta.env.VITE_FIREBASE_CONFIG as string | undefined) ||
    ((import.meta.env as any).FIREBASE_CONFIG as string | undefined);

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
 */
export function getFirebaseConfig(): FirebaseConfig | null {
  const json = getJsonConfig();

  const apiKey = cleanValue(
    json?.apiKey ||
    import.meta.env.VITE_FIREBASE_API_KEY ||
    (import.meta.env as any).FIREBASE_API_KEY
  );

  const authDomain = cleanValue(
    json?.authDomain ||
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    (import.meta.env as any).FIREBASE_AUTH_DOMAIN
  );

  const projectId = cleanValue(
    json?.projectId ||
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    (import.meta.env as any).FIREBASE_PROJECT_ID
  );

  const storageBucket = cleanValue(
    json?.storageBucket ||
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    (import.meta.env as any).FIREBASE_STORAGE_BUCKET
  );

  const messagingSenderId = cleanValue(
    json?.messagingSenderId ||
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    (import.meta.env as any).FIREBASE_MESSAGING_SENDER_ID
  );

  const appId = cleanValue(
    json?.appId ||
    import.meta.env.VITE_FIREBASE_APP_ID ||
    (import.meta.env as any).FIREBASE_APP_ID
  );

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
  if (config) {
    const present = Object.entries(config)
      .filter(([_, v]) => Boolean(v))
      .map(([k]) => k);
    return {
      isConfigured: true,
      missingRequired: [],
      presentKeys: present,
    };
  }

  const missing: string[] = [];
  const present: string[] = [];

  const checkKey = (keyName: string, label: string) => {
    const val = cleanValue(
      import.meta.env[keyName] ||
      (import.meta.env as any)[keyName.replace('VITE_', '')]
    );
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
    cachedDb = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
    return cachedDb;
  } catch {
    try {
      cachedDb = getFirestore(app);
      return cachedDb;
    } catch (err) {
      console.error('Failed to get Firestore DB:', err);
      return null;
    }
  }
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
