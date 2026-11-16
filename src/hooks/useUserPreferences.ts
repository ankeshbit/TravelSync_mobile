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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getUserPreferences(uid).then((prefs) => {
      if (isMounted) {
        setPreferences(prefs);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [uid]);

  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      if (!uid) return;
      // Optimistic functional state update for UI responsiveness
      setPreferences((prev) => ({ ...prev, [key]: value }));
      await updateUserPreferences(uid, { [key]: value } as Partial<UserPreferences>);
    },
    [uid]
  );

  return {
    preferences,
    loading,
    updatePreference,
  };
}

