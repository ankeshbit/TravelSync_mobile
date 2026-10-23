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

export const offlineStorage = {
  /**
   * Get all saved offline trips for the user
   */
  async getOfflineTrips(userId: string): Promise<OfflineTripSummary[]> {
    if (!userId) return [];
    try {
      const data = await AsyncStorage.getItem(TRIPS_LIST_KEY(userId));
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Failed to get offline trips:', err);
      return [];
    }
  },

  /**
   * Get complete offline bundle for a trip
   */
  async getOfflineTripBundle(userId: string, tripId: string): Promise<OfflineTripBundle | null> {
    if (!userId || !tripId) return null;
    try {
      const data = await AsyncStorage.getItem(TRIP_BUNDLE_KEY(userId, tripId));
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Failed to get offline trip bundle:', err);
      return null;
    }
  },

  /**
   * Save full trip offline pack downloaded from backend
   */
  async saveOfflineTripPack(userId: string, pack: any): Promise<void> {
    if (!userId || !pack || !pack.trip) return;

    const tripId = pack.trip.id;
    const downloadedAt = new Date().toISOString();

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
      placesCount: Array.isArray(pack.itinerary) ? pack.itinerary.length : (pack.places?.length || 0),
    };

    const bundle: OfflineTripBundle = {
      trip: summary,
      itinerary: pack.itinerary || pack.places || [],
      staysAndTransport: pack.staysAndTransport || [],
      documents: pack.documents || [],
      emergencyContacts: pack.emergencyContacts || [],
      notes: pack.notes || [],
      checklist: pack.checklist || [],
      downloadedAt,
    };

    // Save bundle
    await AsyncStorage.setItem(TRIP_BUNDLE_KEY(userId, tripId), JSON.stringify(bundle));

    // Update index list
    const trips = await this.getOfflineTrips(userId);
    const existingIndex = trips.findIndex((t) => t.tripId === tripId);
    if (existingIndex >= 0) {
      trips[existingIndex] = summary;
    } else {
      trips.unshift(summary);
    }
    await AsyncStorage.setItem(TRIPS_LIST_KEY(userId), JSON.stringify(trips));
  },

  /**
   * Delete offline trip data
   */
  async deleteOfflineTrip(userId: string, tripId: string): Promise<void> {
    if (!userId || !tripId) return;
    try {
      await AsyncStorage.removeItem(TRIP_BUNDLE_KEY(userId, tripId));
      await AsyncStorage.removeItem(PENDING_SYNC_KEY(userId, tripId));

      const trips = await this.getOfflineTrips(userId);
      const updated = trips.filter((t) => t.tripId !== tripId);
      await AsyncStorage.setItem(TRIPS_LIST_KEY(userId), JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to delete offline trip:', err);
    }
  },

  /**
   * Update a place note locally while offline
   */
  async updatePlaceNoteLocal(userId: string, tripId: string, placeId: string, note: string): Promise<void> {
    const bundle = await this.getOfflineTripBundle(userId, tripId);
    if (!bundle) return;

    const place = bundle.itinerary.find((p: any) => p.id === placeId);
    if (place) {
      place.note = note;
      await AsyncStorage.setItem(TRIP_BUNDLE_KEY(userId, tripId), JSON.stringify(bundle));
      await this.queuePendingSync(userId, tripId, {
        id: `${placeId}_note_${Date.now()}`,
        tripId,
        type: 'place_note',
        payload: { placeId, note },
        timestamp: new Date().toISOString(),
      });
    }
  },

  /**
   * Queue pending sync action
   */
  async queuePendingSync(userId: string, tripId: string, item: PendingSyncItem): Promise<void> {
    const queue = await this.getPendingSyncQueue(userId, tripId);
    queue.push(item);
    await AsyncStorage.setItem(PENDING_SYNC_KEY(userId, tripId), JSON.stringify(queue));
  },

  /**
   * Get pending sync items
   */
  async getPendingSyncQueue(userId: string, tripId: string): Promise<PendingSyncItem[]> {
    if (!userId || !tripId) return [];
    try {
      const data = await AsyncStorage.getItem(PENDING_SYNC_KEY(userId, tripId));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  /**
   * Clear pending sync items
   */
  async clearPendingSyncQueue(userId: string, tripId: string): Promise<void> {
    if (!userId || !tripId) return;
    try {
      await AsyncStorage.removeItem(PENDING_SYNC_KEY(userId, tripId));
    } catch (err) {
      console.error('Failed to clear pending sync queue:', err);
    }
  },
};
