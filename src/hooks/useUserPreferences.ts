import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
  getUserPreferences,
  updateUserPreferences,
} from '@/utils/userPreferences';

export function useUserPreferences() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || '';
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [loading, setLoading] = useState(Boolean(uid));
  const [localOverrides, setLocalOverrides] = useState<Partial<UserPreferences>>({});

  // (b) Reset preferences to default and loading=true when uid changes (render-phase reset)
  const [prevUid, setPrevUid] = useState(uid);
  if (uid !== prevUid) {
    setPrevUid(uid);
    setPreferences(DEFAULT_USER_PREFERENCES);
    setLoading(Boolean(uid));
    setLocalOverrides({});
  }

  // (a) Load effect: merge with locally modified values so user changes are not clobbered
  useEffect(() => {
    if (!uid) {
      return;
    }

    let isMounted = true;

    getUserPreferences(uid).then((storedPrefs) => {
      if (isMounted) {
        setPreferences((prev) => ({
          ...storedPrefs,
          ...localOverrides,
        }));
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [uid, localOverrides]);

  // (c) updatePreference: optimistic update with rollback on failure
  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      if (!uid) return;
      const previousValue = preferences[key];
      // Optimistic functional state update for UI responsiveness
      setLocalOverrides((prev) => ({ ...prev, [key]: value }));
      setPreferences((prev) => ({ ...prev, [key]: value }));

      try {
        await updateUserPreferences(uid, { [key]: value } as Partial<UserPreferences>);
      } catch (err) {
        setPreferences((prev) => ({ ...prev, [key]: previousValue }));
        setLocalOverrides((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        console.error('[useUserPreferences] Failed to update preference, reverting:', err);
      }
    },
    [uid, preferences]
  );

  return {
    preferences,
    loading,
    updatePreference,
  };
}

