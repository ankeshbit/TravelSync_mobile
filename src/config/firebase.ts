import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FIREBASE_CONFIG } from './env';

const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();

let auth: Auth;
try {
  if (Platform.OS === 'web') {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } else {
    // @ts-ignore
    const { getReactNativePersistence } = require('@firebase/auth/dist/rn/index.js');
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} catch {
  auth = getAuth(app);
}

export { app, auth };
