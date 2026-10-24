import { useAuth } from '@/context/AuthContext';

/**
 * Gate data queries to prevent requests prior to authenticated & email-verified state.
 */
export function useIsAuthed(): boolean {
  const { firebaseUser } = useAuth();
  return Boolean(firebaseUser && firebaseUser.emailVerified);
}
