import { User } from './auth';

export type TripStatus = 'planning' | 'upcoming' | 'completed' | 'cancelled';

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  joinedAt: string;
  user?: User;
}

export interface Place {
  id: string;
  tripId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  dayNumber: number;
  orderIndex: number;
  category: string;
  duration: number;
  note?: string;
  createdAt?: string;
}

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  userId: string;
  user?: User;
}

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  receiptUrl?: string;
  paidById: string;
  paidBy?: User;
  splits?: ExpenseSplit[];
  createdAt?: string;
}

export interface Activity {
  id: string;
  tripId: string;
  userId?: string;
  user?: User;
  action: string;
  detail: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  coverImageUrl?: string;
  budgetPerPerson: number;
  currency: string;
  ownerId: string;
  owner?: User;
  members?: TripMember[];
  places?: Place[];
  expenses?: Expense[];
  activities?: Activity[];
  createdAt?: string;
}

export interface TripSummary {
  totalTrips: number;
  upcomingTrips: number;
  totalMembers: number;
  totalSpent: number | null;
  currency: string;
  spentByCurrency: Record<string, number>;
  hasMultipleCurrencies: boolean;
}

export interface TripListResponse {
  trips: Trip[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CreateTripDto {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  budgetPerPerson?: number;
  currency?: string;
}

export interface CreatePlaceDto {
  name: string;
  address: string;
  lat: number;
  lng: number;
  dayNumber: number;
  orderIndex?: number;
  category?: string;
  duration?: number;
  note?: string;
}
