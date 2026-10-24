import { Platform } from 'react-native';

// In production, validate required env vars at startup
if (!__DEV__) {
  const required = [
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  ] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`[Config] Missing required env var: ${key}. Set it in your .env file.`);
    }
  }
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
  const isLocalHost = apiUrl.includes('localhost') || apiUrl.includes('10.0.2.2') || apiUrl.includes('127.0.0.1');
  const isSsrExport = typeof window === 'undefined' && process.env.NODE_ENV === 'production';
  if (isLocalHost && !isSsrExport) {
    throw new Error('[Config] EXPO_PUBLIC_API_URL cannot point to localhost or 10.0.2.2 in production builds.');
  }
}

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

export const getSocketBaseUrl = (): string => {
  return getApiBaseUrl().replace(/\/api\/?$/, '');
};

export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

export const GOOGLE_AUTH_CONFIG = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
};
