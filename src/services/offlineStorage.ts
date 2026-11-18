import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfflineTripSummary {
  id: string;
  tripId: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  currency: string;
  coverImageUrl?: string;
  downloadedAt: string;
  placesCount: number;
}

export interface OfflineTripBundle {
  trip: OfflineTripSummary;
  itinerary: any[];
  staysAndTransport: any[];
  documents: any[];
  emergencyContacts: any[];
  notes: any[];
  checklist: any[];
  downloadedAt: string;
}

export interface PendingSyncItem {
  id: string;
  tripId: string;
  type: 'place_note' | 'place_add' | 'place_delete' | 'checklist';
  payload: any;
  timestamp: string;
  attempts?: number;
  status?: 'pending' | 'needs_attention';
}

const TRIPS_LIST_KEY = (userId: string) => `@travelsync_offline_${userId}_trips`;
const TRIP_BUNDLE_KEY = (userId: string, tripId: string) => `@travelsync_offline_${userId}_trip_${tripId}`;
const PENDING_SYNC_KEY = (userId: string, tripId: string) => `@travelsync_offline_${userId}_sync_${tripId}`;

// Per-key promise queue to serialize read-modify-write operations
const keyLocks = new Map<string, Promise<void>>();

export async function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const currentLock = keyLocks.get(key) || Promise.resolve();
  let release: () => void;
  const nextLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  keyLocks.set(key, nextLock);

  try {
    // Wait for previous lock even if it threw an error
    await currentLock.catch(() => {});
    return await fn();
  } finally {
    release!();
    if (keyLocks.get(key) === nextLock) {
      keyLocks.delete(key);
    }
  }
}

/**
 * Internal unlocked helpers to read/write storage without acquiring locks.
 * Used by locked public methods and composite operations to prevent nested lock deadlocks.
 */
async function readTripBundleUnlocked(userId: string, tripId: string): Promise<OfflineTripBundle | null> {
  if (!userId || !tripId) return null;
  try {
    const data = await AsyncStorage.getItem(TRIP_BUNDLE_KEY(userId, tripId));
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Failed to get offline trip bundle:', err);
    return null;
  }
}

async function writeTripBundleUnlocked(userId: string, tripId: string, bundle: OfflineTripBundle): Promise<void> {
  await AsyncStorage.setItem(TRIP_BUNDLE_KEY(userId, tripId), JSON.stringify(bundle));
}

async function readTripsUnlocked(userId: string): Promise<OfflineTripSummary[]> {
  if (!userId) return [];
  try {
    const data = await AsyncStorage.getItem(TRIPS_LIST_KEY(userId));
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Failed to get offline trips:', err);
    return [];
  }
}

async function writeTripsUnlocked(userId: string, trips: OfflineTripSummary[]): Promise<void> {
  await AsyncStorage.setItem(TRIPS_LIST_KEY(userId), JSON.stringify(trips));
}

async function readQueueUnlocked(userId: string, tripId: string): Promise<PendingSyncItem[]> {
  if (!userId || !tripId) return [];
  try {
    const data = await AsyncStorage.getItem(PENDING_SYNC_KEY(userId, tripId));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function writeQueueUnlocked(userId: string, tripId: string, queue: PendingSyncItem[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_SYNC_KEY(userId, tripId), JSON.stringify(queue));
}

export const offlineStorage = {
  /**
   * Helper to migrate an individual trip bundle and pending queue.
   * If both queues exist, merges them and dedupes by item id.
   */
  async migrateTripKeys(legacyUserId: string, uid: string, tripId: string): Promise<void> {
    const oldBundleKey = TRIP_BUNDLE_KEY(legacyUserId, tripId);
    const newBundleKey = TRIP_BUNDLE_KEY(uid, tripId);
    const oldSyncKey = PENDING_SYNC_KEY(legacyUserId, tripId);
    const newSyncKey = PENDING_SYNC_KEY(uid, tripId);

    // Migrate trip bundle
    const oldBundle = await AsyncStorage.getItem(oldBundleKey);
    if (oldBundle) {
      const hasNewBundle = await AsyncStorage.getItem(newBundleKey);
      if (!hasNewBundle) {
        await AsyncStorage.setItem(newBundleKey, oldBundle);
      }
      await AsyncStorage.removeItem(oldBundleKey);
    }

    // Migrate pending queue: merge if both exist
    const oldSync = await AsyncStorage.getItem(oldSyncKey);
    if (oldSync) {
      try {
        const oldQueue: PendingSyncItem[] = JSON.parse(oldSync);
        const newSync = await AsyncStorage.getItem(newSyncKey);
        if (newSync) {
          const newQueue: PendingSyncItem[] = JSON.parse(newSync);
          const seenIds = new Set(newQueue.map((item) => item.id));
          const mergedQueue = [...newQueue];
          for (const item of oldQueue) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              mergedQueue.push(item);
            }
          }
          await AsyncStorage.setItem(newSyncKey, JSON.stringify(mergedQueue));
        } else {
          await AsyncStorage.setItem(newSyncKey, oldSync);
        }
      } catch {
        const hasNewSync = await AsyncStorage.getItem(newSyncKey);
        if (!hasNewSync) {
          await AsyncStorage.setItem(newSyncKey, oldSync);
        }
      }
      await AsyncStorage.removeItem(oldSyncKey);
    }
  },

  /**
   * One-time migration: migrate offline storage keyed by legacy backend user.id to firebaseUser.uid
   */
  async migrateLegacyUserStorage(legacyUserId: string, uid: string): Promise<void> {
    if (!legacyUserId || !uid || legacyUserId === uid) return;
    const legacyTripsKey = TRIPS_LIST_KEY(legacyUserId);

    await withKeyLock(legacyTripsKey, async () => {
      try {
        const legacyData = await AsyncStorage.getItem(legacyTripsKey);
        const trips: OfflineTripSummary[] = legacyData ? JSON.parse(legacyData) : [];
        const existingNewTrips = await this.getOfflineTrips(uid);
        const mergedTrips = [...existingNewTrips];
        const processedTripIds = new Set<string>();

        // 1. Process trips listed in legacy index
        for (const t of trips) {
          processedTripIds.add(t.tripId);
          if (!mergedTrips.some((mt) => mt.tripId === t.tripId)) {
            mergedTrips.push(t);
          }
          await this.migrateTripKeys(legacyUserId, uid, t.tripId);
        }

        // 2. Discover unindexed legacy bundle and queue keys
        const allKeys = await AsyncStorage.getAllKeys();
        const bundlePrefix = `@travelsync_offline_${legacyUserId}_trip_`;
        const syncPrefix = `@travelsync_offline_${legacyUserId}_sync_`;

        for (const key of allKeys) {
          let discoveredTripId: string | null = null;
          if (key.startsWith(bundlePrefix)) {
            discoveredTripId = key.slice(bundlePrefix.length);
          } else if (key.startsWith(syncPrefix)) {
            discoveredTripId = key.slice(syncPrefix.length);
          }

          if (discoveredTripId && !processedTripIds.has(discoveredTripId)) {
            processedTripIds.add(discoveredTripId);
            await this.migrateTripKeys(legacyUserId, uid, discoveredTripId);

            // If an unindexed bundle exists, ensure its summary is in the trips index
            const newBundleKey = TRIP_BUNDLE_KEY(uid, discoveredTripId);
            const bundleData = await AsyncStorage.getItem(newBundleKey);
            if (bundleData) {
              try {
                const parsedBundle: OfflineTripBundle = JSON.parse(bundleData);
                if (parsedBundle?.trip && !mergedTrips.some((mt) => mt.tripId === discoveredTripId)) {
                  mergedTrips.push(parsedBundle.trip);
                }
              } catch {}
            }
          }
        }

        await AsyncStorage.setItem(TRIPS_LIST_KEY(uid), JSON.stringify(mergedTrips));
        await AsyncStorage.removeItem(legacyTripsKey);
      } catch (err) {
        console.warn('[offlineStorage] Migration warning:', err);
      }
    });
  },

  /**
   * Get all saved offline trips for the user
   */
  async getOfflineTrips(userId: string): Promise<OfflineTripSummary[]> {
    if (!userId) return [];
    const key = TRIPS_LIST_KEY(userId);
    return withKeyLock(key, () => readTripsUnlocked(userId));
  },

  /**
   * Get complete offline bundle for a trip
   */
  async getOfflineTripBundle(userId: string, tripId: string): Promise<OfflineTripBundle | null> {
    if (!userId || !tripId) return null;
    const key = TRIP_BUNDLE_KEY(userId, tripId);
    return withKeyLock(key, () => readTripBundleUnlocked(userId, tripId));
  },

  /**
   * Save full trip offline pack downloaded from backend.
   * If refreshing an existing pack, pending local changes are reapplied on top of new itinerary.
   */
  async saveOfflineTripPack(userId: string, pack: any): Promise<void> {
    if (!userId || !pack || !pack.trip) return;

    const tripId = pack.trip.id;
    const bundleKey = TRIP_BUNDLE_KEY(userId, tripId);
    const syncKey = PENDING_SYNC_KEY(userId, tripId);

    await withKeyLock(bundleKey, async () => {
      await withKeyLock(syncKey, async () => {
        const downloadedAt = new Date().toISOString();
        const existingQueue = await readQueueUnlocked(userId, tripId);

        const itinerary = [...(pack.itinerary || pack.places || [])];

        // Re-apply pending offline place note edits on top of refreshed data
        for (const item of existingQueue) {
          if (item.type === 'place_note' && item.payload?.placeId) {
            const targetPlace = itinerary.find((p: any) => p && p.id === item.payload.placeId);
            if (targetPlace) {
              targetPlace.note = item.payload.note;
            }
          }
        }

        const summary: OfflineTripSummary = {
          id: tripId,
          tripId,
          name: pack.trip.name,
          destination: pack.trip.destination,
          startDate: pack.trip.startDate,
          endDate: pack.trip.endDate,
          currency: pack.trip.currency || 'USD',
          coverImageUrl: pack.trip.coverImageUrl,
          downloadedAt,
          placesCount: Array.isArray(itinerary) ? itinerary.length : 0,
        };

        const bundle: OfflineTripBundle = {
          trip: summary,
          itinerary,
          staysAndTransport: pack.staysAndTransport || [],
          documents: pack.documents || [],
          emergencyContacts: pack.emergencyContacts || [],
          notes: pack.notes || [],
          checklist: pack.checklist || [],
          downloadedAt,
        };

        // Save bundle
        await writeTripBundleUnlocked(userId, tripId, bundle);

        // Update index list
        const tripsKey = TRIPS_LIST_KEY(userId);
        await withKeyLock(tripsKey, async () => {
          const trips = await readTripsUnlocked(userId);
          const existingIndex = trips.findIndex((t) => t.tripId === tripId);
          if (existingIndex >= 0) {
            trips[existingIndex] = summary;
          } else {
            trips.unshift(summary);
          }
          await writeTripsUnlocked(userId, trips);
        });
      });
    });
  },

  /**
   * Delete offline trip data
   */
  async deleteOfflineTrip(userId: string, tripId: string): Promise<void> {
    if (!userId || !tripId) return;
    const bundleKey = TRIP_BUNDLE_KEY(userId, tripId);
    const syncKey = PENDING_SYNC_KEY(userId, tripId);
    const tripsKey = TRIPS_LIST_KEY(userId);

    await withKeyLock(bundleKey, async () => {
      await withKeyLock(syncKey, async () => {
        try {
          await AsyncStorage.removeItem(bundleKey);
          await AsyncStorage.removeItem(syncKey);

          await withKeyLock(tripsKey, async () => {
            const trips = await readTripsUnlocked(userId);
            const updated = trips.filter((t) => t.tripId !== tripId);
            await writeTripsUnlocked(userId, updated);
          });
        } catch (err) {
          console.error('Failed to delete offline trip:', err);
        }
      });
    });
  },

  /**
   * Update a place note locally while offline.
   * Atomic operation: queues sync first, then writes bundle. If bundle fails, rolls back queue.
   * Returns true on success, false on failure.
   */
  async updatePlaceNoteLocal(userId: string, tripId: string, placeId: string, note: string): Promise<boolean> {
    if (!userId || !tripId || !placeId) return false;
    const bundleKey = TRIP_BUNDLE_KEY(userId, tripId);
    const syncKey = PENDING_SYNC_KEY(userId, tripId);

    return withKeyLock(bundleKey, async () => {
      return withKeyLock(syncKey, async () => {
        try {
          const bundle = await readTripBundleUnlocked(userId, tripId);
          if (!bundle || !Array.isArray(bundle.itinerary)) return false;

          const place = bundle.itinerary.find((p: any) => p && p.id === placeId);
          if (!place) return false;

          const uniqueSuffix = Math.random().toString(36).substring(2, 8);
          const syncItem: PendingSyncItem = {
            id: `${placeId}_note_${Date.now()}_${uniqueSuffix}`,
            tripId,
            type: 'place_note',
            payload: { placeId, note },
            timestamp: new Date().toISOString(),
            attempts: 0,
            status: 'pending',
          };

          // 1. Queue pending sync first under lock
          const queue = await readQueueUnlocked(userId, tripId);
          queue.push(syncItem);
          await writeQueueUnlocked(userId, tripId, queue);

          // 2. Write bundle; if writing bundle fails, rollback the queued item
          try {
            place.note = note;
            await writeTripBundleUnlocked(userId, tripId, bundle);
            return true;
          } catch (bundleErr) {
            const rollbackQueue = queue.filter((i) => i.id !== syncItem.id);
            await writeQueueUnlocked(userId, tripId, rollbackQueue).catch(() => {});
            throw bundleErr;
          }
        } catch (err) {
          console.error('Failed to update place note locally:', err);
          return false;
        }
      });
    });
  },

  /**
   * Queue pending sync action
   */
  async queuePendingSync(userId: string, tripId: string, item: PendingSyncItem): Promise<void> {
    const key = PENDING_SYNC_KEY(userId, tripId);
    await withKeyLock(key, async () => {
      const queue = await readQueueUnlocked(userId, tripId);
      queue.push(item);
      await writeQueueUnlocked(userId, tripId, queue);
    });
  },

  /**
   * Get pending sync items
   */
  async getPendingSyncQueue(userId: string, tripId: string): Promise<PendingSyncItem[]> {
    if (!userId || !tripId) return [];
    const key = PENDING_SYNC_KEY(userId, tripId);
    return withKeyLock(key, () => readQueueUnlocked(userId, tripId));
  },

  /**
   * Clear pending sync items. If acknowledgedIds provided, only acknowledged items are removed.
   */
  async clearPendingSyncQueue(userId: string, tripId: string, acknowledgedIds?: string[]): Promise<void> {
    if (!userId || !tripId) return;
    const key = PENDING_SYNC_KEY(userId, tripId);
    await withKeyLock(key, async () => {
      try {
        if (acknowledgedIds && Array.isArray(acknowledgedIds) && acknowledgedIds.length > 0) {
          const queue = await readQueueUnlocked(userId, tripId);
          const remaining = queue.filter((item) => !acknowledgedIds.includes(item.id));
          await writeQueueUnlocked(userId, tripId, remaining);
        } else {
          await AsyncStorage.removeItem(key);
        }
      } catch (err) {
        console.error('Failed to clear pending sync queue:', err);
      }
    });
  },

  /**
   * Record explicitly failed sync attempts.
   * Increments attempts counter; if attempts >= 3, moves item to 'needs_attention'.
   */
  async recordSyncFailures(userId: string, tripId: string, failedIds: string[]): Promise<PendingSyncItem[]> {
    if (!userId || !tripId || !failedIds || failedIds.length === 0) return [];
    const key = PENDING_SYNC_KEY(userId, tripId);
    return withKeyLock(key, async () => {
      try {
        const queue = await readQueueUnlocked(userId, tripId);
        const failedSet = new Set(failedIds);
        for (const item of queue) {
          if (failedSet.has(item.id)) {
            item.attempts = (item.attempts || 0) + 1;
            if (item.attempts >= 3) {
              item.status = 'needs_attention';
            }
          }
        }
        await writeQueueUnlocked(userId, tripId, queue);
        return queue;
      } catch (err) {
        console.error('Failed to record sync failures:', err);
        return [];
      }
    });
  },

  /**
   * Discard a pending sync item manually from the queue.
   */
  async discardPendingSyncItem(userId: string, tripId: string, itemId: string): Promise<void> {
    if (!userId || !tripId || !itemId) return;
    const key = PENDING_SYNC_KEY(userId, tripId);
    await withKeyLock(key, async () => {
      try {
        const queue = await readQueueUnlocked(userId, tripId);
        const remaining = queue.filter((item) => item.id !== itemId);
        await writeQueueUnlocked(userId, tripId, remaining);
      } catch (err) {
        console.error('Failed to discard pending sync item:', err);
      }
    });
  },
};
