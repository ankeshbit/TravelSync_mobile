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
  lat?: number;
  lng?: number;
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
  userId?: string;
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
  coverImageUrl?: string;
}

export interface UpdateTripDto {
  name?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  budgetPerPerson?: number;
  currency?: string;
  status?: TripStatus;
  coverImageUrl?: string;
}

export interface CreatePlaceDto {
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  dayNumber: number;
  orderIndex?: number;
  category?: string;
  duration?: number;
  note?: string;
}

export interface CreateExpenseDto {
  title: string;
  amount: number;
  currency?: string;
  category?: string;
  paidById: string;
  splitUserIds?: string[];
}

export interface BalanceSettlement {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
  currency: string;
}

export interface MemberWithBalance {
  id: string;
  name: string;
  email?: string;
  picture?: string;
  netBalance: number;
  paid: number;
  share: number;
}

export interface BalancesResponse {
  currency?: string;
  balanceMap?: Record<string, number>;
  membersWithBalance?: MemberWithBalance[];
  settlements?: BalanceSettlement[];
  byCurrency?: Record<string, any>;
}

export interface ExploreDestination {
  name: string;
  tripCount: number;
  coverImageUrl?: string;
  averageBudgetPerPerson: number;
  currency?: string;
}

export interface AiSuggestion {
  name: string;
  title?: string;
  location?: string;
  category: string;
  dayNumber: number;
  description: string;
  estimatedCost?: number;
  duration?: number;
}

export interface AiChatRecommendation {
  destination: string;
  name?: string;
  country?: string;
  score?: number;
  explanation?: string;
  description?: string;
  highlights?: string[];
}

export interface AiChatResponse {
  reply?: string;
  message?: string;
  assistant_response?: string;
  recommendations?: AiChatRecommendation[];
  destinations?: any[];
  structuredFollowUps?: any[];
  followUps?: string[];
  suggestions?: AiSuggestion[];
  extracted_preferences?: Record<string, any>;
}
