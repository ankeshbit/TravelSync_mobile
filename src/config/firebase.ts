import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG } from './env';

// Prevent duplicate Firebase app initialization (safe for hot reload)
const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();

// Native (iOS/Android): use AsyncStorage persistence.
// This file is ONLY loaded by Metro on native platforms (iOS/Android).
// For web, Metro loads firebase.web.ts instead (platform extension resolution).
// We must NOT import or reference @firebase/auth/dist/rn/index.js on web,
// as it causes Metro static render errors ("Requiring unknown module").
let auth: Auth;
try {
  // getReactNativePersistence is not exported from 'firebase/auth' top-level
  // in Firebase 13.x — it lives in the internal RN distribution.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getReactNativePersistence } = require('@firebase/auth/dist/rn/index.js');
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e: any) {
  // Handles: auth/already-initialized (hot reload), or missing module fallback
  if (e?.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    console.warn('[Firebase] Native auth init failed, falling back to default:', e?.message);
    auth = getAuth(app);
  }
}

export { app, auth };
