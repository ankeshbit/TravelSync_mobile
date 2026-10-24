import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
import { getReactNativePersistence } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG } from './env';

// Prevent duplicate Firebase app initialization (safe for hot reload)
const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();

// Native (iOS/Android): use AsyncStorage persistence.
// Verified export from node_modules/@firebase/auth/dist/rn/index.js (line 53, line 244).
// Re-exported under "react-native" export condition in node_modules/@firebase/auth/package.json.
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e: any) {
  if (e?.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    console.warn('[Firebase] Native auth initialization failed, falling back to getAuth:', e?.message || e);
    auth = getAuth(app);
  }
}

export { app, auth };
