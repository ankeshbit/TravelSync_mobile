import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTrips, getTripSummary, createTrip, deleteTrip } from '@/api/trips';
import { CreateTripDto } from '@/types/trip';

export const TRIP_KEYS = {
  all: ['trips'] as const,
  lists: () => [...TRIP_KEYS.all, 'list'] as const,
  list: (page: number, limit: number) => [...TRIP_KEYS.lists(), { page, limit }] as const,
  summary: () => [...TRIP_KEYS.all, 'summary'] as const,
  detail: (id: string) => [...TRIP_KEYS.all, 'detail', id] as const,
  places: (id: string) => [...TRIP_KEYS.all, 'places', id] as const,
  expenses: (id: string) => [...TRIP_KEYS.all, 'expenses', id] as const,
};

export function useTrips(page = 1, limit = 20) {
  return useQuery({
    queryKey: TRIP_KEYS.list(page, limit),
    queryFn: () => getTrips(page, limit),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useTripSummary() {
  return useQuery({
    queryKey: TRIP_KEYS.summary(),
    queryFn: () => getTripSummary(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTripDto) => createTrip(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.summary() });
    },
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTrip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.summary() });
    },
  });
}
