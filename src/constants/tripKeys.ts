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
