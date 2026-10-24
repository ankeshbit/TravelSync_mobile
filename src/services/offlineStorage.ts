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

async function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const currentLock = keyLocks.get(key) || Promise.resolve();
  let release: () => void;
  const nextLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  keyLocks.set(key, nextLock);

  try {
    await currentLock;
    return await fn();
  } finally {
    release!();
    if (keyLocks.get(key) === nextLock) {
      keyLocks.delete(key);
    }
  }
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
    return withKeyLock(key, async () => {
      try {
        const data = await AsyncStorage.getItem(key);
        return data ? JSON.parse(data) : [];
      } catch (err) {
        console.error('Failed to get offline trips:', err);
        return [];
      }
    });
  },

  /**
   * Get complete offline bundle for a trip
   */
  async getOfflineTripBundle(userId: string, tripId: string): Promise<OfflineTripBundle | null> {
    if (!userId || !tripId) return null;
    const key = TRIP_BUNDLE_KEY(userId, tripId);
    return withKeyLock(key, async () => {
      try {
        const data = await AsyncStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        console.error('Failed to get offline trip bundle:', err);
        return null;
      }
    });
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
      const existingQueue = await this.getPendingSyncQueue(userId, tripId);

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
      await AsyncStorage.setItem(key, JSON.stringify(bundle));

      // Update index list
      const tripsKey = TRIPS_LIST_KEY(userId);
      const trips = await this.getOfflineTrips(userId);
      const existingIndex = trips.findIndex((t) => t.tripId === tripId);
      if (existingIndex >= 0) {
        trips[existingIndex] = summary;
      } else {
        trips.unshift(summary);
      }
      await AsyncStorage.setItem(tripsKey, JSON.stringify(trips));
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

        const trips = await this.getOfflineTrips(userId);
        const updated = trips.filter((t) => t.tripId !== tripId);
        await AsyncStorage.setItem(tripsKey, JSON.stringify(updated));
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
        const bundle = await this.getOfflineTripBundle(userId, tripId);
        if (!bundle || !Array.isArray(bundle.itinerary)) return false;

        const place = bundle.itinerary.find((p: any) => p && p.id === placeId);
        if (!place) return false;

        place.note = note;
        await AsyncStorage.setItem(key, JSON.stringify(bundle));

        await this.queuePendingSync(userId, tripId, {
          id: `${placeId}_note_${Date.now()}`,
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
      const queue = await this.getPendingSyncQueue(userId, tripId);
      queue.push(item);
      await AsyncStorage.setItem(key, JSON.stringify(queue));
    });
  },

  /**
   * Get pending sync items
   */
  async getPendingSyncQueue(userId: string, tripId: string): Promise<PendingSyncItem[]> {
    if (!userId || !tripId) return [];
    const key = PENDING_SYNC_KEY(userId, tripId);
    return withKeyLock(key, async () => {
      try {
        const data = await AsyncStorage.getItem(key);
        return data ? JSON.parse(data) : [];
      } catch {
        return [];
      }
    });
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
          const queue = await this.getPendingSyncQueue(userId, tripId);
          const remaining = queue.filter((item) => !acknowledgedIds.includes(item.id));
          await AsyncStorage.setItem(key, JSON.stringify(remaining));
        } else {
          await AsyncStorage.removeItem(key);
        }
      } catch (err) {
        console.error('Failed to clear pending sync queue:', err);
      }
    });
  },
};
