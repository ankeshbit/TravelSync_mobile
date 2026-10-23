import { Platform } from 'react-native';

/**
 * Resolves the backend API URL.
 * In Android emulators, localhost maps to 10.0.2.2.
 * On real devices, specify EXPO_PUBLIC_API_URL with your local LAN IP (e.g. http://192.168.1.10:3000/api)
 * or deployed backend (e.g. https://your-backend.onrender.com/api).
 */
export const getApiBaseUrl = (): string => {
  const customUrl = process.env.EXPO_PUBLIC_API_URL;
  if (customUrl && customUrl.trim()) {
    if (Platform.OS === 'web' && customUrl.includes('10.0.2.2')) {
      return customUrl.replace('10.0.2.2', 'localhost').trim().replace(/\/+$/, '');
    }
    return customUrl.trim().replace(/\/+$/, '');
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }

  return 'http://localhost:3000/api';
};

export const API_BASE_URL = getApiBaseUrl();

export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyExampleKey-TravelSyncMobile',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'travelsync-app.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'travelsync-app',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'travelsync-app.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456',
};
