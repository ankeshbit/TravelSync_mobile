import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getUserPreferences,
  updateUserPreferences,
  DEFAULT_USER_PREFERENCES,
  PREFS_KEY,
  clearUserPreferencesMemoryCache,
  clearUserPreferences,
} from '../utils/userPreferences';

describe('userPreferences persistence and concurrency', () => {
  const uid = 'test_prefs_user_1';
  const storageKey = PREFS_KEY(uid);

  beforeEach(async () => {
    clearUserPreferencesMemoryCache();
    await AsyncStorage.removeItem(storageKey);
  });

  afterEach(async () => {
    clearUserPreferencesMemoryCache();
    await AsyncStorage.removeItem(storageKey);
  });

  it('loads default preferences when nothing has been stored', async () => {
    const prefs = await getUserPreferences(uid);
    expect(prefs).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it('reliably persists and reloads preferences across application restarts', async () => {
    await updateUserPreferences(uid, {
      preferredCurrency: 'EUR',
      notifyTripUpdates: false,
    });

    // Simulate app restart by reading fresh
    const reloaded = await getUserPreferences(uid);
    expect(reloaded.preferredCurrency).toBe('EUR');
    expect(reloaded.notifyTripUpdates).toBe(false);
    expect(reloaded.notifyExpenseAlerts).toBe(true);
    expect(reloaded.notifyLiveActivity).toBe(true);
  });

  it('prevents race conditions when rapid concurrent updates occur', async () => {
    // Concurrently trigger updates for different fields in parallel
    const p1 = updateUserPreferences(uid, { preferredCurrency: 'JPY' });
    const p2 = updateUserPreferences(uid, { notifyTripUpdates: false });
    const p3 = updateUserPreferences(uid, { notifyExpenseAlerts: false });
    const p4 = updateUserPreferences(uid, { notifyLiveActivity: false });

    await Promise.all([p1, p2, p3, p4]);

    const finalPrefs = await getUserPreferences(uid);
    // All 4 concurrent updates must be preserved in the final state!
    expect(finalPrefs.preferredCurrency).toBe('JPY');
    expect(finalPrefs.notifyTripUpdates).toBe(false);
    expect(finalPrefs.notifyExpenseAlerts).toBe(false);
    expect(finalPrefs.notifyLiveActivity).toBe(false);
  });

  it('preserves existing preference keys in storage format', async () => {
    // Manually write in legacy format
    const legacy = {
      preferredCurrency: 'GBP',
      notifyTripUpdates: true,
      notifyExpenseAlerts: false,
      notifyLiveActivity: true,
    };
    await AsyncStorage.setItem(storageKey, JSON.stringify(legacy));

    const loaded = await getUserPreferences(uid);
    expect(loaded.preferredCurrency).toBe('GBP');
    expect(loaded.notifyExpenseAlerts).toBe(false);

    // Update single field
    await updateUserPreferences(uid, { preferredCurrency: 'INR' });

    // Verify storage still has all keys
    const rawSaved = await AsyncStorage.getItem(storageKey);
    const parsed = JSON.parse(rawSaved!);
    expect(parsed.preferredCurrency).toBe('INR');
    expect(parsed.notifyExpenseAlerts).toBe(false);
    expect(parsed.notifyTripUpdates).toBe(true);
    expect(parsed.notifyLiveActivity).toBe(true);
  });

  it('falls back safely when stored JSON is invalid', async () => {
    await AsyncStorage.setItem(storageKey, 'corrupt-not-json');
    const prefs = await getUserPreferences(uid);
    expect(prefs).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it('clears stored preferences and memory cache via clearUserPreferences', async () => {
    await updateUserPreferences(uid, { preferredCurrency: 'AUD' });
    const loaded = await getUserPreferences(uid);
    expect(loaded.preferredCurrency).toBe('AUD');

    await clearUserPreferences(uid);

    const reloaded = await getUserPreferences(uid);
    expect(reloaded.preferredCurrency).toBe('USD'); // Reset to default
    const stored = await AsyncStorage.getItem(storageKey);
    expect(stored).toBeNull();
  });

  it('rethrows error and reverts memory cache if AsyncStorage.setItem fails', async () => {
    await updateUserPreferences(uid, { preferredCurrency: 'CAD' });

    const originalSetItem = AsyncStorage.setItem;
    (AsyncStorage.setItem as jest.Mock) = jest.fn().mockRejectedValueOnce(new Error('Disk write failure'));

    await expect(updateUserPreferences(uid, { preferredCurrency: 'JPY' })).rejects.toThrow('Disk write failure');

    AsyncStorage.setItem = originalSetItem;
    const current = await getUserPreferences(uid);
    expect(current.preferredCurrency).toBe('CAD');
  });
});
