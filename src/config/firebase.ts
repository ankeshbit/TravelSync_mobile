import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FIREBASE_CONFIG } from './env';

const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();

let auth: Auth;
try {
  if (Platform.OS === 'web') {
    // Web: getAuth includes browserPopupRedirectResolver and browserLocalPersistence
    auth = getAuth(app);
  } else {
    // Native (iOS/Android): initializeAuth with AsyncStorage persistence
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getReactNativePersistence } = require('@firebase/auth/dist/rn/index.js');
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} catch {
  auth = getAuth(app);
}

export { app, auth };
