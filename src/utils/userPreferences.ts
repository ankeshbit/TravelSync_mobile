import AsyncStorage from '@react-native-async-storage/async-storage';
import { withKeyLock } from '@/services/offlineStorage';

export interface UserPreferences {
  preferredCurrency: string;
  notifyTripUpdates: boolean;
  notifyExpenseAlerts: boolean;
  notifyLiveActivity: boolean;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  preferredCurrency: 'USD',
  notifyTripUpdates: true,
  notifyExpenseAlerts: true,
  notifyLiveActivity: true,
};

export const PREFS_KEY = (uid: string) => `user_prefs_${uid}`;
export const DEFAULT_PREFERENCES = DEFAULT_USER_PREFERENCES;
export const getPreferencesKey = PREFS_KEY;

export async function updateUserPreference<K extends keyof UserPreferences>(
  uid: string,
  key: K,
  val: UserPreferences[K]
): Promise<UserPreferences> {
  return updateUserPreferences(uid, { [key]: val } as Partial<UserPreferences>);
}

// In-memory cache to ensure consistency across rapid sequential operations
const memoryCache = new Map<string, UserPreferences>();

export function getCachedUserPreferences(uid: string): UserPreferences {
  return memoryCache.get(uid) || { ...DEFAULT_USER_PREFERENCES };
}

export function clearUserPreferencesMemoryCache(uid?: string): void {
  if (uid) {
    memoryCache.delete(uid);
  } else {
    memoryCache.clear();
  }
}

/**
 * Safely load user preferences from AsyncStorage with key locking.
 */
export async function getUserPreferences(uid: string): Promise<UserPreferences> {
  if (!uid) return { ...DEFAULT_USER_PREFERENCES };

  const key = PREFS_KEY(uid);
  return withKeyLock(key, async () => {
    try {
      const saved = await AsyncStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        const prefs: UserPreferences = {
          preferredCurrency:
            typeof parsed.preferredCurrency === 'string'
              ? parsed.preferredCurrency
              : DEFAULT_USER_PREFERENCES.preferredCurrency,
          notifyTripUpdates:
            typeof parsed.notifyTripUpdates === 'boolean'
              ? parsed.notifyTripUpdates
              : DEFAULT_USER_PREFERENCES.notifyTripUpdates,
          notifyExpenseAlerts:
            typeof parsed.notifyExpenseAlerts === 'boolean'
              ? parsed.notifyExpenseAlerts
              : DEFAULT_USER_PREFERENCES.notifyExpenseAlerts,
          notifyLiveActivity:
            typeof parsed.notifyLiveActivity === 'boolean'
              ? parsed.notifyLiveActivity
              : DEFAULT_USER_PREFERENCES.notifyLiveActivity,
        };
        memoryCache.set(uid, prefs);
        return prefs;
      }
    } catch (err) {
      console.warn('[userPreferences] Failed to load preferences:', err);
      memoryCache.delete(uid);
      return { ...DEFAULT_USER_PREFERENCES };
    }
    const fallback = memoryCache.get(uid) || { ...DEFAULT_USER_PREFERENCES };
    memoryCache.set(uid, fallback);
    return fallback;
  });
}

/**
 * Atomically update user preferences to prevent concurrent overwrite race conditions.
 */
export async function updateUserPreferences(
  uid: string,
  updater: Partial<UserPreferences> | ((prev: UserPreferences) => Partial<UserPreferences>)
): Promise<UserPreferences> {
  if (!uid) return { ...DEFAULT_USER_PREFERENCES };

  const key = PREFS_KEY(uid);
  return withKeyLock(key, async () => {
    let current: UserPreferences;
    const cached = memoryCache.get(uid);
    if (cached) {
      current = cached;
    } else {
      try {
        const saved = await AsyncStorage.getItem(key);
        current = saved ? { ...DEFAULT_USER_PREFERENCES, ...JSON.parse(saved) } : { ...DEFAULT_USER_PREFERENCES };
      } catch {
        current = { ...DEFAULT_USER_PREFERENCES };
      }
    }

    const updates = typeof updater === 'function' ? updater(current) : updater;
    const next: UserPreferences = {
      preferredCurrency:
        typeof updates.preferredCurrency === 'string'
          ? updates.preferredCurrency
          : current.preferredCurrency,
      notifyTripUpdates:
        typeof updates.notifyTripUpdates === 'boolean'
          ? updates.notifyTripUpdates
          : current.notifyTripUpdates,
      notifyExpenseAlerts:
        typeof updates.notifyExpenseAlerts === 'boolean'
          ? updates.notifyExpenseAlerts
          : current.notifyExpenseAlerts,
      notifyLiveActivity:
        typeof updates.notifyLiveActivity === 'boolean'
          ? updates.notifyLiveActivity
          : current.notifyLiveActivity,
    };

    memoryCache.set(uid, next);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(next));
    } catch (err) {
      console.error('[userPreferences] Failed to persist preferences:', err);
    }
    return next;
  });
}
