import { api } from './client';
import {
  Trip,
  TripListResponse,
  TripSummary,
  TripMember,
  Place,
  Expense,
  Activity,
  BalancesResponse,
  CreateTripDto,
  UpdateTripDto,
  CreatePlaceDto,
  CreateExpenseDto,
  ExploreDestination,
  AiSuggestion,
  AiChatResponse,
} from '@/types/trip';

/**
 * Fetch all trips for the authenticated user.
 */
export async function getTrips(page = 1, limit = 20, search?: string): Promise<TripListResponse> {
  const params: Record<string, any> = { page, limit };
  if (search && search.trim()) {
    params.search = search.trim();
    params.q = search.trim();
  }
  const response = await api.get<TripListResponse>('/trips', {
    params,
  });
  return response.data;
}

/**
 * Fetch dashboard overview statistics.
 */
export async function getTripSummary(): Promise<TripSummary> {
  const response = await api.get<TripSummary>('/trips/summary');
  return response.data;
}

/**
 * Fetch a single trip by ID with full details (places, members, expenses).
 */
export async function getTripById(id: string): Promise<Trip> {
  const response = await api.get<Trip>(`/trips/${id}`);
  return response.data;
}

/**
 * Create a new trip.
 */
export async function createTrip(data: CreateTripDto): Promise<Trip> {
  const response = await api.post<Trip>('/trips', data);
  return response.data;
}

/**
 * Update an existing trip.
 */
export async function updateTrip(id: string, data: UpdateTripDto): Promise<Trip> {
  const response = await api.put<Trip>(`/trips/${id}`, data);
  return response.data;
}

/**
 * Delete a trip by ID (owner only).
 */
export async function deleteTrip(id: string): Promise<void> {
  await api.delete(`/trips/${id}`);
}

/**
 * Fetch members for a trip.
 */
export async function getTripMembers(tripId: string): Promise<TripMember[]> {
  const response = await api.get<TripMember[]>(`/trips/${tripId}/members`);
  return response.data;
}

/**
 * Add a member to a trip by email address.
 */
export async function addTripMember(tripId: string, email: string): Promise<Trip> {
  const response = await api.post<Trip>(`/trips/${tripId}/members`, { email: email.trim() });
  return response.data;
}

/**
 * Remove a member from a trip (owner only).
 */
export async function removeTripMember(tripId: string, userId: string): Promise<Trip> {
  const response = await api.delete<Trip>(`/trips/${tripId}/members/${userId}`);
  return response.data;
}

/**
 * Leave a trip (member self-removal).
 */
export async function leaveTrip(tripId: string): Promise<void> {
  await api.delete(`/trips/${tripId}/members/me`);
}

/**
 * Fetch places/itinerary items for a specific trip.
 */
export async function getTripPlaces(tripId: string): Promise<Place[]> {
  const response = await api.get<Place[]>(`/trips/${tripId}/places`);
  return response.data;
}

/**
 * Add a place/activity to a trip itinerary.
 */
export async function addTripPlace(tripId: string, data: CreatePlaceDto): Promise<Place> {
  const response = await api.post<Place>(`/trips/${tripId}/places`, data);
  return response.data;
}

/**
 * Delete a place from a trip itinerary.
 */
export async function deleteTripPlace(tripId: string, placeId: string): Promise<void> {
  await api.delete(`/trips/${tripId}/places/${placeId}`);
}

/**
 * Update note for a specific place in the itinerary.
 */
export async function updatePlaceNote(tripId: string, placeId: string, note: string): Promise<Place> {
  const response = await api.patch<Place>(`/trips/${tripId}/places/${placeId}/note`, { note });
  return response.data;
}

/**
 * Reorder itinerary places within/across days.
 */
export async function reorderTripPlaces(
  tripId: string,
  updates: { placeId: string; dayNumber: number; orderIndex: number }[]
): Promise<Place[]> {
  const response = await api.patch<Place[]>(`/trips/${tripId}/places/reorder`, updates);
  return response.data;
}


export interface OfflineChangeItem {
  id: string;
  tripId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface OfflineSyncResult {
  synced?: string[];
  failed?: string[];
  acknowledgedIds?: string[];
  syncedIds?: string[];
  failedIds?: string[];
  results?: { id: string; success?: boolean; synced?: boolean; failed?: boolean; error?: string }[];
  syncedCount?: number;
  failedCount?: number;
  errors?: Record<string, string>;
  [key: string]: unknown;
}

export interface NormalizedSyncResult {
  syncedIds: string[];
  failedIds: string[];
  syncedCount: number;
  failedCount: number;
  isFullSuccess: boolean;
  isPartialSuccess: boolean;
  isFullFailure: boolean;
  errors?: Record<string, string>;
}

/**
 * Normalizes disparate sync API response formats into a single predictable contract.
 * Deduplicates IDs, distinguishes full/partial/complete failures, and retains failed items.
 */
export function normalizeSyncResult(
  data: unknown,
  submittedQueue: { id: string }[] = []
): NormalizedSyncResult {
  const syncedSet = new Set<string>();
  const failedSet = new Set<string>();
  const errors: Record<string, string> = {};

  if (data && typeof data === 'object') {
    const raw = data as Record<string, unknown>;

    // 1. Detailed results array: e.g. [{ id: '1', success: true, error: '...' }]
    if (Array.isArray(raw.results)) {
      for (const item of raw.results) {
        if (item && typeof item === 'object') {
          const id = String((item as any).id || (item as any).itemId || '').trim();
          if (id) {
            if ((item as any).success === true || (item as any).synced === true) {
              syncedSet.add(id);
            } else if ((item as any).success === false || (item as any).failed === true || (item as any).error) {
              failedSet.add(id);
              if ((item as any).error) {
                errors[id] = String((item as any).error);
              }
            }
          }
        }
      }
    }

    // 2. ID arrays: acknowledgedIds, syncedIds, synced, processed
    const idArrays = [raw.acknowledgedIds, raw.syncedIds, raw.synced, raw.processed];
    for (const arr of idArrays) {
      if (Array.isArray(arr)) {
        for (const id of arr) {
          if (typeof id === 'string' && id.trim()) {
            syncedSet.add(id.trim());
          }
        }
      }
    }

    // 3. Failed ID arrays: failedIds, failed
    const failedArrays = [raw.failedIds, raw.failed];
    for (const arr of failedArrays) {
      if (Array.isArray(arr)) {
        for (const id of arr) {
          if (typeof id === 'string' && id.trim()) {
            failedSet.add(id.trim());
          }
        }
      }
    }

    // 4. Errors dictionary: { [id: string]: string }
    if (raw.errors && typeof raw.errors === 'object' && !Array.isArray(raw.errors)) {
      for (const [id, msg] of Object.entries(raw.errors)) {
        failedSet.add(id);
        errors[id] = String(msg);
      }
    }

    // 5. If raw.success === true and no specific synced/failed IDs were provided, but all submitted items were accepted
    if (raw.success === true && syncedSet.size === 0 && failedSet.size === 0 && submittedQueue.length > 0) {
      for (const item of submittedQueue) {
        if (item.id) syncedSet.add(item.id);
      }
    }
  }

  // Deduplicate and ensure no ID is in both synced and failed
  for (const syncedId of syncedSet) {
    failedSet.delete(syncedId);
  }

  // If there are partial acknowledgements, any unacknowledged submitted items are marked failed/unresolved
  if (syncedSet.size > 0 && submittedQueue.length > 0) {
    for (const item of submittedQueue) {
      if (!syncedSet.has(item.id) && !failedSet.has(item.id)) {
        failedSet.add(item.id);
      }
    }
  }

  const syncedIds = Array.from(syncedSet);
  const failedIds = Array.from(failedSet);

  const isFullSuccess = syncedIds.length > 0 && failedIds.length === 0;
  const isPartialSuccess = syncedIds.length > 0 && failedIds.length > 0;
  const isFullFailure = syncedIds.length === 0 && (failedIds.length > 0 || submittedQueue.length > 0);

  return {
    syncedIds,
    failedIds,
    syncedCount: syncedIds.length,
    failedCount: failedIds.length,
    isFullSuccess,
    isPartialSuccess,
    isFullFailure,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

export interface OfflineTripPack {
  trip: {
    id: string;
    name: string;
    destination: string;
    startDate: string;
    endDate: string;
    currency: string;
    coverImageUrl?: string | null;
    status: string;
    ownerId: string;
    budgetPerPerson?: number;
  };
  itinerary?: unknown[];
  places?: unknown[];
  staysAndTransport?: unknown[];
  documents?: unknown[];
  emergencyContacts?: unknown[];
  notes?: unknown[];
  checklist?: unknown[];
}

/**
 * Fetch full offline pack for a trip (metadata, itinerary, expenses, checklist, notes).
 */
export async function getOfflineTripPack(tripId: string): Promise<OfflineTripPack> {
  const response = await api.get(`/trips/${tripId}/offline-pack`);
  return response.data;
}

/**
 * Sync offline batch changes to backend.
 */
export async function syncOfflineChanges(tripId: string, changes: OfflineChangeItem[]): Promise<OfflineSyncResult> {
  // Flatten payload fields (placeId, note, etc.) to root level to match backend offlineSyncItemSchema
  const formattedChanges = changes.map((c) => ({
    id: c.id,
    type: c.type,
    placeId: (c.payload as any)?.placeId || (c as any).placeId,
    itemId: (c.payload as any)?.placeId || (c as any).placeId || (c as any).itemId,
    note: (c.payload as any)?.note !== undefined ? (c.payload as any).note : (c as any).note,
    content: (c.payload as any)?.note !== undefined ? (c.payload as any).note : (c as any).content,
    modifiedAt: c.timestamp,
  }));
  const response = await api.post(`/trips/${tripId}/offline-sync`, { changes: formattedChanges });
  return response.data;
}

/**
 * Fetch expenses for a trip.
 */
export async function getTripExpenses(tripId: string): Promise<Expense[]> {
  const response = await api.get<any>(`/trips/${tripId}/expenses`);
  return response.data?.expenses ?? (Array.isArray(response.data) ? response.data : []);
}

/**
 * Add an expense to a trip.
 */
export async function addTripExpense(tripId: string, data: CreateExpenseDto): Promise<Expense> {
  const response = await api.post<Expense>(`/trips/${tripId}/expenses`, data);
  return response.data;
}

/**
 * Delete an expense from a trip.
 */
export async function deleteTripExpense(tripId: string, expenseId: string): Promise<void> {
  await api.delete(`/trips/${tripId}/expenses/${expenseId}`);
}

/**
 * Fetch expense balance settlement ("who owes whom").
 */
export async function getTripBalances(tripId: string): Promise<BalancesResponse> {
  const response = await api.get<BalancesResponse>(`/trips/${tripId}/expenses/balances`);
  return response.data;
}

/**
 * Request AI itinerary suggestions for a trip.
 */
export async function getAiTripSuggestions(tripId: string, preferences?: Record<string, any>): Promise<AiSuggestion[]> {
  const response = await api.post<any>(`/trips/${tripId}/ai-suggestions`, preferences || {});
  return response.data?.suggestions ?? (Array.isArray(response.data) ? response.data : []);
}

/**
 * Fetch trip audit / activity timeline.
 */
export async function getTripActivity(tripId: string): Promise<Activity[]> {
  const response = await api.get<Activity[]>(`/trips/${tripId}/activity`);
  return response.data;
}

/**
 * Fetch aggregated destination cards for Explore.
 */
export async function getExploreDestinations(q?: string): Promise<ExploreDestination[]> {
  const params: Record<string, string> = {};
  if (q && q.trim()) {
    params.q = q.trim();
  }
  const response = await api.get<any>('/explore/destinations', { params });
  return Array.isArray(response.data) ? response.data : (response.data?.destinations || []);
}

/**
 * Send a chat message to the TravelSync AI recommendation assistant.
 */
export interface StructuredAnswer {
  field: string;
  value: any;
  label?: string;
}

export async function chatWithAiGuide(
  message: string,
  previousPreferences?: Record<string, any>,
  structuredAnswers?: StructuredAnswer[]
): Promise<AiChatResponse> {
  const payload: Record<string, any> = {
    message: message.trim(),
    previous_preferences: previousPreferences || null,
  };
  if (structuredAnswers && structuredAnswers.length > 0) {
    payload.structured_answers = structuredAnswers;
  }
  const response = await api.post<AiChatResponse>('/recommendations/chat', payload);
  return response.data;
}
