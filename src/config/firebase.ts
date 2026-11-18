import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
import { getReactNativePersistence } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG } from './env';

// Prevent duplicate Firebase app initialization (safe for hot reload)
const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();

// Web uses standard getAuth with browser persistence.
// Native (iOS/Android) uses initializeAuth with AsyncStorage React Native persistence.
let auth: Auth;

if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e: any) {
    if (e?.code === 'auth/already-initialized') {
      auth = getAuth(app);
    } else {
      console.error(
        '[Firebase] CRITICAL: Native auth persistence initialization failed! Falling back to non-persistent getAuth. Sessions will NOT persist across app restarts:',
        e?.message || e
      );
      auth = getAuth(app);
    }
  }
}

export { app, auth };
