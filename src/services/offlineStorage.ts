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
   * One-time migration: migrate offline storage keyed by legacy backend user.id to firebaseUser.uid
   */
  async migrateLegacyUserStorage(legacyUserId: string, uid: string): Promise<void> {
    if (!legacyUserId || !uid || legacyUserId === uid) return;
    const legacyTripsKey = TRIPS_LIST_KEY(legacyUserId);

    await withKeyLock(legacyTripsKey, async () => {
      try {
        const legacyData = await AsyncStorage.getItem(legacyTripsKey);
        if (!legacyData) return;

        const trips: OfflineTripSummary[] = JSON.parse(legacyData);
        const existingNewTrips = await this.getOfflineTrips(uid);
        const mergedTrips = [...existingNewTrips];

        for (const t of trips) {
          if (!mergedTrips.some((mt) => mt.tripId === t.tripId)) {
            mergedTrips.push(t);
          }

          // Migrate trip bundle
          const oldBundleKey = TRIP_BUNDLE_KEY(legacyUserId, t.tripId);
          const newBundleKey = TRIP_BUNDLE_KEY(uid, t.tripId);
          const oldBundle = await AsyncStorage.getItem(oldBundleKey);
          if (oldBundle) {
            const hasNewBundle = await AsyncStorage.getItem(newBundleKey);
            if (!hasNewBundle) {
              await AsyncStorage.setItem(newBundleKey, oldBundle);
            }
            await AsyncStorage.removeItem(oldBundleKey);
          }

          // Migrate pending queue
          const oldSyncKey = PENDING_SYNC_KEY(legacyUserId, t.tripId);
          const newSyncKey = PENDING_SYNC_KEY(uid, t.tripId);
          const oldSync = await AsyncStorage.getItem(oldSyncKey);
          if (oldSync) {
            const hasNewSync = await AsyncStorage.getItem(newSyncKey);
            if (!hasNewSync) {
              await AsyncStorage.setItem(newSyncKey, oldSync);
            }
            await AsyncStorage.removeItem(oldSyncKey);
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
    const key = TRIP_BUNDLE_KEY(userId, tripId);

    await withKeyLock(key, async () => {
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
  },

  /**
   * Update a place note locally while offline.
   * Returns true on success, false on failure.
   */
  async updatePlaceNoteLocal(userId: string, tripId: string, placeId: string, note: string): Promise<boolean> {
    if (!userId || !tripId || !placeId) return false;
    const key = TRIP_BUNDLE_KEY(userId, tripId);

    return withKeyLock(key, async () => {
      try {
        const bundle = await readTripBundleUnlocked(userId, tripId);
        if (!bundle || !Array.isArray(bundle.itinerary)) return false;

        const place = bundle.itinerary.find((p: any) => p && p.id === placeId);
        if (!place) return false;

        place.note = note;
        await writeTripBundleUnlocked(userId, tripId, bundle);

        const uniqueSuffix = Math.random().toString(36).substring(2, 8);
        await this.queuePendingSync(userId, tripId, {
          id: `${placeId}_note_${Date.now()}_${uniqueSuffix}`,
          tripId,
          type: 'place_note',
          payload: { placeId, note },
          timestamp: new Date().toISOString(),
        });

        return true;
      } catch (err) {
        console.error('Failed to update place note locally:', err);
        return false;
      }
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
};
