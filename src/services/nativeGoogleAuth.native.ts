import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { AuthSessionResult } from 'expo-auth-session';
import { GOOGLE_AUTH_CONFIG } from '@/config/env';

// Complete any pending auth session on native
WebBrowser.maybeCompleteAuthSession();

export interface NativeGoogleAuthHook {
  isConfigured: boolean;
  isReady: boolean;
  promptGoogleAsync: () => Promise<AuthSessionResult>;
}

export function useNativeGoogleAuth(): NativeGoogleAuthHook {
  const hasClientId = Boolean(
    GOOGLE_AUTH_CONFIG.webClientId ||
    GOOGLE_AUTH_CONFIG.androidClientId ||
    GOOGLE_AUTH_CONFIG.iosClientId
  );

  // Pass a dummy clientId fallback if unconfigured so invariantClientId does not throw during initial render
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_AUTH_CONFIG.webClientId || 'unconfigured.apps.googleusercontent.com',
    webClientId: GOOGLE_AUTH_CONFIG.webClientId || undefined,
    iosClientId: GOOGLE_AUTH_CONFIG.iosClientId || undefined,
    androidClientId: GOOGLE_AUTH_CONFIG.androidClientId || undefined,
  });

  return {
    isConfigured: hasClientId,
    isReady: Boolean(request),
    promptGoogleAsync: promptAsync,
  };
}
