import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTripById,
  getTripPlaces,
  addTripPlace,
  deleteTripPlace,
  updatePlaceNote,
  reorderTripPlaces,
  getTripExpenses,
  addTripExpense,
  deleteTripExpense,
  getTripBalances,
  getTripMembers,
  addTripMember,
  removeTripMember,
  leaveTrip,
  getAiTripSuggestions,
  getTripActivity,
} from '@/api/trips';
import { CreatePlaceDto, CreateExpenseDto } from '@/types/trip';
import { TRIP_KEYS } from './useTrips';
import { useIsAuthed } from './useIsAuthed';

export function useTrip(id: string) {
  const isAuthed = useIsAuthed();

  return useQuery({
    queryKey: TRIP_KEYS.detail(id),
    queryFn: () => getTripById(id),
    enabled: isAuthed && Boolean(id),
    staleTime: 1000 * 60 * 2,
  });
}

export function useTripMembers(tripId: string) {
  const isAuthed = useIsAuthed();

  return useQuery({
    queryKey: TRIP_KEYS.members(tripId),
    queryFn: () => getTripMembers(tripId),
    enabled: isAuthed && Boolean(tripId),
    staleTime: 1000 * 60 * 2,
  });
}

export function useAddTripMember(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: string) => addTripMember(tripId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.members(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });
    },
  });
}

export function useRemoveTripMember(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeTripMember(tripId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.members(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });
    },
  });
}

export function useLeaveTrip(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => leaveTrip(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.summary() });
    },
  });
}

export function useTripPlaces(tripId: string) {
  const isAuthed = useIsAuthed();

  return useQuery({
    queryKey: TRIP_KEYS.places(tripId),
    queryFn: () => getTripPlaces(tripId),
    enabled: isAuthed && Boolean(tripId),
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
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });
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
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });
    },
  });
}

export function useUpdatePlaceNote(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ placeId, note }: { placeId: string; note: string }) =>
      updatePlaceNote(tripId, placeId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.places(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
    },
  });
}

export function useReorderTripPlaces(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: { placeId: string; dayNumber: number; orderIndex: number }[]) =>
      reorderTripPlaces(tripId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.places(tripId) });
    },
  });
}

export function useTripExpenses(tripId: string) {
  const isAuthed = useIsAuthed();

  return useQuery({
    queryKey: TRIP_KEYS.expenses(tripId),
    queryFn: () => getTripExpenses(tripId),
    enabled: isAuthed && Boolean(tripId),
    staleTime: 1000 * 60 * 2,
  });
}

export function useAddTripExpense(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExpenseDto) => addTripExpense(tripId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.expenses(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.balances(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.summary() });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });
    },
  });
}

export function useDeleteTripExpense(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expenseId: string) => deleteTripExpense(tripId, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.expenses(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.balances(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.summary() });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });
    },
  });
}

export function useTripBalances(tripId: string) {
  const isAuthed = useIsAuthed();

  return useQuery({
    queryKey: TRIP_KEYS.balances(tripId),
    queryFn: () => getTripBalances(tripId),
    enabled: isAuthed && Boolean(tripId),
    staleTime: 1000 * 60 * 2,
  });
}

export function useAiTripSuggestions(tripId: string) {
  return useMutation({
    mutationFn: (preferences?: Record<string, any>) => getAiTripSuggestions(tripId, preferences),
  });
}

export function useTripActivity(tripId: string) {
  const isAuthed = useIsAuthed();

  return useQuery({
    queryKey: TRIP_KEYS.activity(tripId),
    queryFn: () => getTripActivity(tripId),
    enabled: isAuthed && Boolean(tripId),
    staleTime: 1000 * 60 * 2,
  });
}
