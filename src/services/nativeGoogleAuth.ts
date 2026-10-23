import { AuthSessionResult } from 'expo-auth-session';

export interface NativeGoogleAuthHook {
  isConfigured: boolean;
  isReady: boolean;
  promptGoogleAsync: () => Promise<AuthSessionResult>;
}

export function useNativeGoogleAuth(): NativeGoogleAuthHook {
  return {
    isConfigured: false,
    isReady: false,
    promptGoogleAsync: async (): Promise<AuthSessionResult> => {
      return { type: 'dismiss' };
    },
  };
}
