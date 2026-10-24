import { useAuth } from '@/context/AuthContext';
import { Trip } from '@/types/trip';
import { User } from '@/types/auth';
import { User as FirebaseUser } from 'firebase/auth';

/**
 * Pure function to check if the current user is the owner of the trip.
 * Safely guards against missing IDs so undefined === undefined never evaluates to true.
 */
export function isTripOwner(
  trip?: Trip | null,
  user?: User | null,
  firebaseUser?: FirebaseUser | null
): boolean {
  if (!trip) return false;

  const currentUserId = user?.id;
  const currentFirebaseUid = firebaseUser?.uid;

  if (!currentUserId && !currentFirebaseUid) return false;

  const tripOwnerId = trip.ownerId || trip.owner?.id;

  if (tripOwnerId) {
    if (currentUserId && tripOwnerId === currentUserId) return true;
    if (currentFirebaseUid && tripOwnerId === currentFirebaseUid) return true;
  }

  if (trip.userId) {
    if (currentUserId && trip.userId === currentUserId) return true;
    if (currentFirebaseUid && trip.userId === currentFirebaseUid) return true;
  }

  return false;
}

/**
 * Hook to check if the authenticated user is the owner of the given trip.
 */
export function useIsTripOwner(trip?: Trip | null): boolean {
  const { user, firebaseUser } = useAuth();
  return isTripOwner(trip, user, firebaseUser);
}
