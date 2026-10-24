import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { FIREBASE_CONFIG } from './env';

const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();

// Web: use standard getAuth (browserLocalPersistence + browserPopupRedirectResolver included)
const auth = getAuth(app);

export { app, auth };
