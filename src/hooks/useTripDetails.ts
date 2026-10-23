import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTripById, getTripPlaces, addTripPlace, deleteTripPlace, getTripExpenses } from '@/api/trips';
import { CreatePlaceDto } from '@/types/trip';
import { TRIP_KEYS } from './useTrips';

export function useTrip(id: string) {
  return useQuery({
    queryKey: TRIP_KEYS.detail(id),
    queryFn: () => getTripById(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 2,
  });
}

export function useTripPlaces(tripId: string) {
  return useQuery({
    queryKey: TRIP_KEYS.places(tripId),
    queryFn: () => getTripPlaces(tripId),
    enabled: Boolean(tripId),
    staleTime: 1000 * 60 * 2,
  });
}

export function useAddTripPlace(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePlaceDto) => addTripPlace(tripId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.places(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
    },
  });
}

export function useDeleteTripPlace(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (placeId: string) => deleteTripPlace(tripId, placeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.places(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
    },
  });
}

export function useTripExpenses(tripId: string) {
  return useQuery({
    queryKey: TRIP_KEYS.expenses(tripId),
    queryFn: () => getTripExpenses(tripId),
    enabled: Boolean(tripId),
    staleTime: 1000 * 60 * 2,
  });
}
