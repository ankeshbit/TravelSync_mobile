import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateFirebaseProfile,
  sendEmailVerification,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import { getCurrentUser, logoutBackend } from '@/api/auth';
import { User } from '@/types/auth';
import { getErrorMessage } from '@/api/client';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  syncBackendUser: () => Promise<User | null>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const syncBackendUser = useCallback(async (): Promise<User | null> => {
    if (!auth.currentUser) {
      setUser(null);
      return null;
    }

    try {
      const dbUser = await getCurrentUser();
      setUser(dbUser);
      return dbUser;
    } catch (err: any) {
      // If error is 403 EMAIL_NOT_VERIFIED, keep firebaseUser but indicate email verification needed
      if (err?.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setError('Please verify your email address to access your trips.');
      } else {
        // Backend DB sync failure could be network/offline
        console.warn('[AuthContext] Backend sync warning:', getErrorMessage(err));
      }
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        await syncBackendUser();
      } else {
        setUser(null);
      }

      setIsInitializing(false);
    });

    return () => unsubscribe();
  }, [syncBackendUser]);

  const loginWithEmail = async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      setFirebaseUser(cred.user);
      await syncBackendUser();
    } catch (err: any) {
      const friendlyMessage = getFirebaseErrorMessage(err);
      setError(friendlyMessage);
      throw new Error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const registerWithEmail = async (name: string, email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      await updateFirebaseProfile(cred.user, { displayName: name.trim() });
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // Non-fatal if verification email delivery fails on dev/test
      }
      setFirebaseUser(cred.user);
      await syncBackendUser();
    } catch (err: any) {
      const friendlyMessage = getFirebaseErrorMessage(err);
      setError(friendlyMessage);
      throw new Error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutBackend().catch(() => {});
      await firebaseSignOut(auth);
      setFirebaseUser(null);
      setUser(null);
      setError(null);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isInitializing,
        isLoading,
        error,
        loginWithEmail,
        registerWithEmail,
        logout,
        syncBackendUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function getFirebaseErrorMessage(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    default:
      return error?.message || 'Authentication failed. Please try again.';
  }
}
