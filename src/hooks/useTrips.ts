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

export const TRIP_KEYS = {
  all: ['trips'] as const,
  lists: () => [...TRIP_KEYS.all, 'list'] as const,
  list: (search?: string) => [...TRIP_KEYS.lists(), { search: search || '' }] as const,
  summary: () => [...TRIP_KEYS.all, 'summary'] as const,
  detail: (id: string) => [...TRIP_KEYS.all, 'detail', id] as const,
  members: (id: string) => [...TRIP_KEYS.all, 'members', id] as const,
  places: (id: string) => [...TRIP_KEYS.all, 'places', id] as const,
  expenses: (id: string) => [...TRIP_KEYS.all, 'expenses', id] as const,
  balances: (id: string) => [...TRIP_KEYS.all, 'balances', id] as const,
  activity: (id: string) => [...TRIP_KEYS.all, 'activity', id] as const,
  explore: (q?: string) => ['explore', q || ''] as const,
};

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
    onSuccess: () => {
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
