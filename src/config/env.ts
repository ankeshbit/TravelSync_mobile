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
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyALzehITyb7-KJC7shQf_1kPPC1uaLuT-c',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'travelsync-2509e.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'travelsync-2509e',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'travelsync-2509e.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '698271050805',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:698271050805:web:3649fdea2ae2bbf15e157c',
};

export const GOOGLE_AUTH_CONFIG = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
};
