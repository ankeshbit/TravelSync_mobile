import { AuthSessionResult } from 'expo-auth-session';

export interface NativeGoogleAuthHook {
  isConfigured: boolean;
  isReady: boolean;
  promptGoogleAsync: () => Promise<AuthSessionResult>;
}

export function useNativeGoogleAuth(): NativeGoogleAuthHook {
  return {
    isConfigured: true,
    isReady: true,
    promptGoogleAsync: async (): Promise<AuthSessionResult> => {
      // On web, Firebase signInWithPopup is used directly instead of expo-auth-session
      return { type: 'dismiss' };
    },
  };
}
