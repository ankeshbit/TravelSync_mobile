import { api } from './client';
import {
  Trip,
  TripListResponse,
  TripSummary,
  Place,
  Expense,
  CreateTripDto,
  CreatePlaceDto,
} from '@/types/trip';

/**
 * Fetch all trips for the authenticated user.
 */
export async function getTrips(page = 1, limit = 20): Promise<TripListResponse> {
  const response = await api.get<TripListResponse>('/trips', {
    params: { page, limit },
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
 * Delete a trip by ID.
 */
export async function deleteTrip(id: string): Promise<void> {
  await api.delete(`/trips/${id}`);
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
 * Fetch expenses for a trip.
 */
export async function getTripExpenses(tripId: string): Promise<Expense[]> {
  const response = await api.get<Expense[]>(`/trips/${tripId}/expenses`);
  return response.data;
}
