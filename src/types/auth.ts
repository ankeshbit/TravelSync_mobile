export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  picture?: string;
  createdAt?: string;
}

export interface AuthState {
  user: User | null;
  firebaseUser: any | null;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
}
