import AsyncStorage from '@react-native-async-storage/async-storage';
import { withKeyLock, offlineStorage } from '../services/offlineStorage';

describe('offlineStorage withKeyLock', () => {
  it('serializes concurrent operations on the same key', async () => {
    const sequence: number[] = [];
    const key = 'test_key_1';

    const op1 = withKeyLock(key, async () => {
      await new Promise((r) => setTimeout(r, 50));
      sequence.push(1);
      return 1;
    });

    const op2 = withKeyLock(key, async () => {
      await new Promise((r) => setTimeout(r, 10));
      sequence.push(2);
      return 2;
    });

    const results = await Promise.all([op1, op2]);
    expect(results).toEqual([1, 2]);
    expect(sequence).toEqual([1, 2]);
  });

  it('allows parallel operations across different keys', async () => {
    const sequence: string[] = [];

    const op1 = withKeyLock('key_A', async () => {
      await new Promise((r) => setTimeout(r, 60));
      sequence.push('A');
    });

    const op2 = withKeyLock('key_B', async () => {
      await new Promise((r) => setTimeout(r, 10));
      sequence.push('B');
    });

    await Promise.all([op1, op2]);
    // key_B finishes before key_A because they run concurrently
    expect(sequence).toEqual(['B', 'A']);
  });

  it('releases lock even when an operation throws', async () => {
    const key = 'failing_key';

    await expect(
      withKeyLock(key, async () => {
        throw new Error('Lock error');
      })
    ).rejects.toThrow('Lock error');

    // Next operation on same key must still succeed without deadlock
    const nextResult = await withKeyLock(key, async () => 'recovered');
    expect(nextResult).toBe('recovered');
  });

  it('ensures consecutive locks execute even if a previous lock threw an error', async () => {
    const key = 'error_recovery_key';
    const errPromise = withKeyLock(key, async () => {
      throw new Error('Initial lock failure');
    }).catch((e) => e.message);

    const successPromise = withKeyLock(key, async () => 'success_after_failure');

    const [errMessage, successResult] = await Promise.all([errPromise, successPromise]);
    expect(errMessage).toBe('Initial lock failure');
    expect(successResult).toBe('success_after_failure');
  });
});

describe('offlineStorage pending sync queue', () => {
  const userId = 'test_user_sync_1';
  const tripId = 'test_trip_sync_1';

  beforeEach(async () => {
    await offlineStorage.clearPendingSyncQueue(userId, tripId);
  });

  it('queues items and selectively clears only acknowledged IDs', async () => {
    const item1 = { id: 'item_1', tripId, type: 'place_note' as const, payload: { placeId: 'p1', note: 'n1' }, timestamp: '2026-01-01' };
    const item2 = { id: 'item_2', tripId, type: 'place_note' as const, payload: { placeId: 'p2', note: 'n2' }, timestamp: '2026-01-02' };
    const item3 = { id: 'item_3', tripId, type: 'place_note' as const, payload: { placeId: 'p3', note: 'n3' }, timestamp: '2026-01-03' };

    await offlineStorage.queuePendingSync(userId, tripId, item1);
    await offlineStorage.queuePendingSync(userId, tripId, item2);
    await offlineStorage.queuePendingSync(userId, tripId, item3);

    const queueBefore = await offlineStorage.getPendingSyncQueue(userId, tripId);
    expect(queueBefore).toHaveLength(3);

    // Acknowledge item1 and item3 (e.g. successfully synced)
    await offlineStorage.clearPendingSyncQueue(userId, tripId, ['item_1', 'item_3']);

    const queueAfter = await offlineStorage.getPendingSyncQueue(userId, tripId);
    expect(queueAfter).toHaveLength(1);
    expect(queueAfter[0].id).toBe('item_2');
    expect(queueAfter[0].payload.note).toBe('n2');
  });

  it('returns empty array when userId or tripId is missing', async () => {
    const res = await offlineStorage.getPendingSyncQueue('', '');
    expect(res).toEqual([]);
  });
});

describe('offlineStorage updatePlaceNoteLocal and bundle operations', () => {
  const userId = 'test_user_note_1';
  const tripId = 'test_trip_note_1';

  const mockPack = {
    trip: {
      id: tripId,
      name: 'Tokyo Trip',
      destination: 'Tokyo, Japan',
      startDate: '2026-05-01',
      endDate: '2026-05-07',
      currency: 'JPY',
    },
    itinerary: [
      { id: 'place_1', name: 'Shibuya Crossing', note: 'Existing note' },
      { id: 'place_2', name: 'Tokyo Tower' }, // no note initially
    ],
  };

  beforeEach(async () => {
    await offlineStorage.deleteOfflineTrip(userId, tripId);
    await offlineStorage.clearPendingSyncQueue(userId, tripId);
  });

  afterEach(async () => {
    await offlineStorage.deleteOfflineTrip(userId, tripId);
    await offlineStorage.clearPendingSyncQueue(userId, tripId);
  });

  it('updates an existing place note without deadlock', async () => {
    await offlineStorage.saveOfflineTripPack(userId, mockPack);

    const success = await offlineStorage.updatePlaceNoteLocal(
      userId,
      tripId,
      'place_1',
      'Updated note content'
    );
    expect(success).toBe(true);

    const bundle = await offlineStorage.getOfflineTripBundle(userId, tripId);
    expect(bundle?.itinerary[0].note).toBe('Updated note content');

    const queue = await offlineStorage.getPendingSyncQueue(userId, tripId);
    expect(queue).toHaveLength(1);
    expect(queue[0].payload).toEqual({
      placeId: 'place_1',
      note: 'Updated note content',
    });
  });

  it('adds a note to a place that previously had no note', async () => {
    await offlineStorage.saveOfflineTripPack(userId, mockPack);

    const success = await offlineStorage.updatePlaceNoteLocal(
      userId,
      tripId,
      'place_2',
      'Brand new note for Tokyo Tower'
    );
    expect(success).toBe(true);

    const bundle = await offlineStorage.getOfflineTripBundle(userId, tripId);
    expect(bundle?.itinerary[1].note).toBe('Brand new note for Tokyo Tower');

    const queue = await offlineStorage.getPendingSyncQueue(userId, tripId);
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.note).toBe('Brand new note for Tokyo Tower');
  });

  it('safely returns false when the offline bundle does not exist', async () => {
    const success = await offlineStorage.updatePlaceNoteLocal(
      userId,
      'non_existent_trip',
      'place_1',
      'Note for missing bundle'
    );
    expect(success).toBe(false);
  });

  it('safely returns false when the placeId is not in the bundle', async () => {
    await offlineStorage.saveOfflineTripPack(userId, mockPack);

    const success = await offlineStorage.updatePlaceNoteLocal(
      userId,
      tripId,
      'missing_place_id',
      'Note for missing place'
    );
    expect(success).toBe(false);
  });

  it('handles concurrent updates to the same trip without overwriting or deadlocking', async () => {
    await offlineStorage.saveOfflineTripPack(userId, mockPack);

    // Concurrently update place_1 and place_2
    const [res1, res2] = await Promise.all([
      offlineStorage.updatePlaceNoteLocal(userId, tripId, 'place_1', 'Concurrent Note 1'),
      offlineStorage.updatePlaceNoteLocal(userId, tripId, 'place_2', 'Concurrent Note 2'),
    ]);

    expect(res1).toBe(true);
    expect(res2).toBe(true);

    const bundle = await offlineStorage.getOfflineTripBundle(userId, tripId);
    expect(bundle?.itinerary[0].note).toBe('Concurrent Note 1');
    expect(bundle?.itinerary[1].note).toBe('Concurrent Note 2');

    const queue = await offlineStorage.getPendingSyncQueue(userId, tripId);
    expect(queue).toHaveLength(2);
    const notes = queue.map((q) => q.payload.note);
    expect(notes).toContain('Concurrent Note 1');
    expect(notes).toContain('Concurrent Note 2');
  });

  it('ensures lock is released and bundle remains readable after an update error', async () => {
    await offlineStorage.saveOfflineTripPack(userId, mockPack);

    // Call update with an invalid/missing placeId
    const res = await offlineStorage.updatePlaceNoteLocal(userId, tripId, 'invalid_place', 'note');
    expect(res).toBe(false);

    // Subsequent read and write operations on the same trip must immediately succeed
    const bundle = await offlineStorage.getOfflineTripBundle(userId, tripId);
    expect(bundle).not.toBeNull();

    const secondUpdate = await offlineStorage.updatePlaceNoteLocal(
      userId,
      tripId,
      'place_1',
      'Recovered update'
    );
    expect(secondUpdate).toBe(true);
  });

  it('preserves pending offline notes when refreshing an offline pack', async () => {
    await offlineStorage.saveOfflineTripPack(userId, mockPack);

    await offlineStorage.updatePlaceNoteLocal(userId, tripId, 'place_1', 'Offline modified note');

    // Re-download fresh pack from server with original server note
    const refreshedServerPack = {
      trip: mockPack.trip,
      itinerary: [
        { id: 'place_1', name: 'Shibuya Crossing', note: 'Server fresh note' },
        { id: 'place_2', name: 'Tokyo Tower', note: 'Server fresh tower' },
      ],
    };

    await offlineStorage.saveOfflineTripPack(userId, refreshedServerPack);

    // Pending offline note must be preserved over server note
    const bundle = await offlineStorage.getOfflineTripBundle(userId, tripId);
    expect(bundle?.itinerary[0].note).toBe('Offline modified note');
    expect(bundle?.itinerary[1].note).toBe('Server fresh tower');
  });
});

describe('offlineStorage updatePlaceNoteLocal', () => {
  const userId = 'user_notes_1';
  const tripId = 'trip_notes_1';

  beforeEach(async () => {
    await offlineStorage.deleteOfflineTrip(userId, tripId);
    await offlineStorage.clearPendingSyncQueue(userId, tripId);
  });

  it('returns false when offline bundle does not exist', async () => {
    const res = await offlineStorage.updatePlaceNoteLocal(userId, tripId, 'place_123', 'My note');
    expect(res).toBe(false);
  });

  it('updates an existing place note without deadlock', async () => {
    const pack = {
      trip: {
        id: tripId,
        name: 'Paris Adventure',
        destination: 'Paris',
        startDate: '2026-06-01',
        endDate: '2026-06-07',
      },
      itinerary: [
        { id: 'p1', name: 'Eiffel Tower', note: 'Initial note' },
        { id: 'p2', name: 'Louvre' },
      ],
    };

    await offlineStorage.saveOfflineTripPack(userId, pack);

    const updateSuccess = await offlineStorage.updatePlaceNoteLocal(userId, tripId, 'p1', 'Updated note for Eiffel Tower');
    expect(updateSuccess).toBe(true);

    const bundle = await offlineStorage.getOfflineTripBundle(userId, tripId);
    expect(bundle).not.toBeNull();
    const p1 = bundle?.itinerary.find((p) => p.id === 'p1');
    expect(p1?.note).toBe('Updated note for Eiffel Tower');

    const queue = await offlineStorage.getPendingSyncQueue(userId, tripId);
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('place_note');
    expect(queue[0].payload).toEqual({ placeId: 'p1', note: 'Updated note for Eiffel Tower' });
  });

  it('adds a note to a place that does not have one', async () => {
    const pack = {
      trip: {
        id: tripId,
        name: 'Tokyo Trip',
        destination: 'Tokyo',
        startDate: '2026-07-01',
        endDate: '2026-07-10',
      },
      itinerary: [{ id: 'place_no_note', name: 'Shibuya Crossing' }],
    };

    await offlineStorage.saveOfflineTripPack(userId, pack);

    const updateSuccess = await offlineStorage.updatePlaceNoteLocal(userId, tripId, 'place_no_note', 'First note added');
    expect(updateSuccess).toBe(true);

    const bundle = await offlineStorage.getOfflineTripBundle(userId, tripId);
    const place = bundle?.itinerary.find((p) => p.id === 'place_no_note');
    expect(place?.note).toBe('First note added');
  });

  it('handles concurrent updates to the same trip without deadlocking or losing writes', async () => {
    const pack = {
      trip: {
        id: tripId,
        name: 'Italy Trip',
        destination: 'Rome',
        startDate: '2026-08-01',
        endDate: '2026-08-10',
      },
      itinerary: [
        { id: 'place_A', name: 'Colosseum' },
        { id: 'place_B', name: 'Vatican' },
      ],
    };

    await offlineStorage.saveOfflineTripPack(userId, pack);

    // Run two concurrent updates to different places on the same trip
    const [resA, resB] = await Promise.all([
      offlineStorage.updatePlaceNoteLocal(userId, tripId, 'place_A', 'Note for Colosseum'),
      offlineStorage.updatePlaceNoteLocal(userId, tripId, 'place_B', 'Note for Vatican'),
    ]);

    expect(resA).toBe(true);
    expect(resB).toBe(true);

    const bundle = await offlineStorage.getOfflineTripBundle(userId, tripId);
    const placeA = bundle?.itinerary.find((p) => p.id === 'place_A');
    const placeB = bundle?.itinerary.find((p) => p.id === 'place_B');

    expect(placeA?.note).toBe('Note for Colosseum');
    expect(placeB?.note).toBe('Note for Vatican');

    const queue = await offlineStorage.getPendingSyncQueue(userId, tripId);
    expect(queue).toHaveLength(2);
  });

  it('keeps the bundle unchanged when AsyncStorage.setItem fails on the queue key', async () => {
    const pack = {
      trip: {
        id: tripId,
        name: 'Atomic Note Trip',
        destination: 'Kyoto',
        startDate: '2026-09-01',
        endDate: '2026-09-10',
      },
      itinerary: [
        { id: 'place_atomic', name: 'Fushimi Inari', note: 'Original note' },
      ],
    };

    await offlineStorage.saveOfflineTripPack(userId, pack);

    const originalSetItem = AsyncStorage.setItem;
    // Mock setItem to reject when writing to the pending sync key
    (AsyncStorage.setItem as jest.Mock) = jest.fn((key: string, value: string) => {
      if (key.includes('_sync_')) {
        return Promise.reject(new Error('AsyncStorage sync queue write error'));
      }
      return originalSetItem(key, value);
    });

    const res = await offlineStorage.updatePlaceNoteLocal(userId, tripId, 'place_atomic', 'Should not be saved');
    expect(res).toBe(false);

    // Restore original mock
    AsyncStorage.setItem = originalSetItem;

    // Verify bundle note is completely unchanged
    const bundle = await offlineStorage.getOfflineTripBundle(userId, tripId);
    expect(bundle?.itinerary[0].note).toBe('Original note');

    // Verify queue has nothing
    const queue = await offlineStorage.getPendingSyncQueue(userId, tripId);
    expect(queue).toHaveLength(0);
  });

  it('serializes interleaving between saveOfflineTripPack and deleteOfflineTrip', async () => {
    const pack = {
      trip: {
        id: tripId,
        name: 'Interleaving Trip',
        destination: 'Osaka',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
      },
      itinerary: [{ id: 'p_osaka', name: 'Dotonbori' }],
    };

    // Run save and delete concurrently; consistent lock order prevents deadlock
    await Promise.all([
      offlineStorage.saveOfflineTripPack(userId, pack),
      offlineStorage.deleteOfflineTrip(userId, tripId),
    ]);

    // System did not hang or deadlock
    expect(true).toBe(true);
  });
});

describe('offlineStorage retry limits and manual discard', () => {
  const userId = 'user_retries_1';
  const tripId = 'trip_retries_1';

  beforeEach(async () => {
    await offlineStorage.clearPendingSyncQueue(userId, tripId);
  });

  it('increments attempts counter on explicit failure and flags needs_attention after 3 failures', async () => {
    const item = {
      id: 'failed_item_1',
      tripId,
      type: 'place_note' as const,
      payload: { placeId: 'p1', note: 'test' },
      timestamp: '2026-01-01',
    };

    await offlineStorage.queuePendingSync(userId, tripId, item);

    // Attempt 1
    let q = await offlineStorage.recordSyncFailures(userId, tripId, ['failed_item_1']);
    expect(q[0].attempts).toBe(1);
    expect(q[0].status).not.toBe('needs_attention');

    // Attempt 2
    q = await offlineStorage.recordSyncFailures(userId, tripId, ['failed_item_1']);
    expect(q[0].attempts).toBe(2);
    expect(q[0].status).not.toBe('needs_attention');

    // Attempt 3: moves to needs_attention
    q = await offlineStorage.recordSyncFailures(userId, tripId, ['failed_item_1']);
    expect(q[0].attempts).toBe(3);
    expect(q[0].status).toBe('needs_attention');
  });

  it('discards a pending sync item completely from queue', async () => {
    const item = {
      id: 'discard_me',
      tripId,
      type: 'place_note' as const,
      payload: { placeId: 'p1', note: 'test' },
      timestamp: '2026-01-01',
      attempts: 3,
      status: 'needs_attention' as const,
    };

    await offlineStorage.queuePendingSync(userId, tripId, item);
    expect(await offlineStorage.getPendingSyncQueue(userId, tripId)).toHaveLength(1);

    await offlineStorage.discardPendingSyncItem(userId, tripId, 'discard_me');
    expect(await offlineStorage.getPendingSyncQueue(userId, tripId)).toHaveLength(0);
  });
});

describe('offlineStorage migrateLegacyUserStorage', () => {
  const legacyUserId = 'legacy_backend_user_123';
  const newUid = 'firebase_uid_456';

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('merges legacy and new pending queues and dedupes by item id', async () => {
    const tripId = 'trip_merge_1';

    // Set up legacy queue with item1 and item2
    const legacyQueue = [
      { id: 'item_1', tripId, type: 'place_note', payload: { note: 'legacy note 1' }, timestamp: '2026-01-01' },
      { id: 'item_2', tripId, type: 'place_note', payload: { note: 'legacy note 2' }, timestamp: '2026-01-02' },
    ];
    await AsyncStorage.setItem(`@travelsync_offline_${legacyUserId}_sync_${tripId}`, JSON.stringify(legacyQueue));

    // Set up new queue with item2 (duplicate) and item3 (new)
    const newQueue = [
      { id: 'item_2', tripId, type: 'place_note', payload: { note: 'new note 2' }, timestamp: '2026-01-02' },
      { id: 'item_3', tripId, type: 'place_note', payload: { note: 'new note 3' }, timestamp: '2026-01-03' },
    ];
    await AsyncStorage.setItem(`@travelsync_offline_${newUid}_sync_${tripId}`, JSON.stringify(newQueue));

    // Also set legacy index containing the trip
    const legacyTrips = [
      { id: tripId, tripId, name: 'Merge Trip', destination: 'Tokyo', startDate: '2026-01-01', endDate: '2026-01-05', currency: 'USD', downloadedAt: '2026-01-01', placesCount: 1 },
    ];
    await AsyncStorage.setItem(`@travelsync_offline_${legacyUserId}_trips`, JSON.stringify(legacyTrips));

    await offlineStorage.migrateLegacyUserStorage(legacyUserId, newUid);

    // Check merged queue under newUid
    const mergedSyncData = await AsyncStorage.getItem(`@travelsync_offline_${newUid}_sync_${tripId}`);
    expect(mergedSyncData).not.toBeNull();
    const mergedQueue = JSON.parse(mergedSyncData!);
    expect(mergedQueue).toHaveLength(3);
    const ids = mergedQueue.map((i: any) => i.id);
    expect(ids).toEqual(['item_2', 'item_3', 'item_1']);

    // Legacy sync key must be deleted
    const oldSync = await AsyncStorage.getItem(`@travelsync_offline_${legacyUserId}_sync_${tripId}`);
    expect(oldSync).toBeNull();
  });

  it('discovers unindexed legacy bundle and queue keys and migrates them', async () => {
    const unindexedTripId = 'trip_unindexed_99';

    // Set legacy bundle and sync for a trip NOT in the legacy trips index
    const legacyBundle = {
      trip: { id: unindexedTripId, tripId: unindexedTripId, name: 'Unindexed Trip', destination: 'Rome', startDate: '2026-05-01', endDate: '2026-05-05', currency: 'EUR', downloadedAt: '2026-01-01', placesCount: 1 },
      itinerary: [],
      staysAndTransport: [],
      documents: [],
      emergencyContacts: [],
      notes: [],
      checklist: [],
      downloadedAt: '2026-01-01',
    };
    await AsyncStorage.setItem(`@travelsync_offline_${legacyUserId}_trip_${unindexedTripId}`, JSON.stringify(legacyBundle));
    await AsyncStorage.setItem(`@travelsync_offline_${legacyUserId}_sync_${unindexedTripId}`, JSON.stringify([{ id: 'unindexed_sync_1', tripId: unindexedTripId, type: 'place_note', payload: {}, timestamp: '2026-01-01' }]));

    // Empty legacy trips index
    await AsyncStorage.setItem(`@travelsync_offline_${legacyUserId}_trips`, JSON.stringify([]));

    await offlineStorage.migrateLegacyUserStorage(legacyUserId, newUid);

    // Bundle and queue migrated to newUid
    const newBundle = await AsyncStorage.getItem(`@travelsync_offline_${newUid}_trip_${unindexedTripId}`);
    expect(newBundle).not.toBeNull();
    const newSync = await AsyncStorage.getItem(`@travelsync_offline_${newUid}_sync_${unindexedTripId}`);
    expect(newSync).not.toBeNull();

    // Summary discovered and added to new trips index
    const trips = await offlineStorage.getOfflineTrips(newUid);
    expect(trips.some((t) => t.tripId === unindexedTripId)).toBe(true);
  });
});
