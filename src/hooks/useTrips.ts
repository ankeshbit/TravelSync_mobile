import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData,
} from '@tanstack/react-query';
import {
  getTrips,
  getTripSummary,
  createTrip,
  updateTrip,
  deleteTrip,
  getExploreDestinations,
} from '@/api/trips';
import { CreateTripDto, UpdateTripDto } from '@/types/trip';
import { useIsAuthed } from './useIsAuthed';

import { TRIP_KEYS } from '@/constants/tripKeys';
export { TRIP_KEYS };

export function useTrips(search?: string, limit = 20) {
  const isAuthed = useIsAuthed();

  return useInfiniteQuery({
    queryKey: TRIP_KEYS.list(search),
    queryFn: ({ pageParam = 1 }) => getTrips(pageParam as number, limit, search),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage?.pagination?.hasNextPage) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    enabled: isAuthed,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useTripSummary() {
  const isAuthed = useIsAuthed();

  return useQuery({
    queryKey: TRIP_KEYS.summary(),
    queryFn: () => getTripSummary(),
    enabled: isAuthed,
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

export function useUpdateTrip(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTripDto) => updateTrip(id, data),
    onSuccess: (updatedTrip) => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.summary() });
      return updatedTrip;
    },
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTrip(id),
    onSuccess: (_, tripId: string) => {
      queryClient.removeQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      queryClient.removeQueries({ queryKey: TRIP_KEYS.places(tripId) });
      queryClient.removeQueries({ queryKey: TRIP_KEYS.expenses(tripId) });
      queryClient.removeQueries({ queryKey: TRIP_KEYS.members(tripId) });
      queryClient.removeQueries({ queryKey: TRIP_KEYS.balances(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.summary() });
    },
  });
}

export function useExploreDestinations(query?: string) {
  const isAuthed = useIsAuthed();

  return useQuery({
    queryKey: TRIP_KEYS.explore(query),
    queryFn: () => getExploreDestinations(query),
    placeholderData: keepPreviousData,
    enabled: isAuthed,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}
