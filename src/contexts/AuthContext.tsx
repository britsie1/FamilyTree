import React, { createContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  getFirebaseAuth,
  googleProvider,
  isFirebaseConfigured,
} from '../services/firebase';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isConfigured] = useState<boolean>(() => isFirebaseConfigured());
  const [loading, setLoading] = useState<boolean>(() => Boolean(getFirebaseAuth()));

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isConfigured]);

  const signInWithGoogle = async (): Promise<User | null> => {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error(
        'Firebase configuration is not detected in this build. If you added environment variables in Netlify, make sure to trigger a new deploy (Deploys > Trigger deploy > Clear cache and deploy site).'
      );
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      return result.user;
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return null;
      }
      if (err.code === 'auth/unauthorized-domain') {
        throw new Error(
          `Domain "${window.location.hostname}" is not authorized in your Firebase Console.\n\nPlease go to Firebase Console -> Authentication -> Settings -> Authorized domains, and add "${window.location.hostname}".`
        );
      }
      if (err.code === 'auth/popup-blocked') {
        throw new Error('Google Sign-In popup was blocked by your browser. Please allow popups for this site.');
      }
      if (err.code === 'auth/configuration-not-found') {
        throw new Error(
          'Google Sign-In provider is not enabled in your Firebase project. Go to Firebase Console -> Authentication -> Sign-in method and enable Google.'
        );
      }
      throw err;
    }
  };

  const signOutUser = async (): Promise<void> => {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured,
        signInWithGoogle,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth } from '../hooks/useAuth';
