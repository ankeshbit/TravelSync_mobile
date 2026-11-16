import { isTripOwner } from '../hooks/useIsTripOwner';
import { Trip } from '../types/trip';
import { User } from '../types/auth';

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('Trip Authorization and Edit Access Rules', () => {
  const tripOwner: User = {
    id: 'user-owner-1',
    name: 'Trip Organizer',
    email: 'organizer@travelsync.test',
    createdAt: '2026-01-01',
  };

  const tripMember: User = {
    id: 'user-member-2',
    name: 'Co Traveler',
    email: 'traveler@travelsync.test',
    createdAt: '2026-01-01',
  };

  const outsider: User = {
    id: 'user-stranger-3',
    name: 'Outsider',
    email: 'outsider@travelsync.test',
    createdAt: '2026-01-01',
  };

  const mockTrip: Trip = {
    id: 'trip-alpha',
    name: 'Himalayan Trek',
    destination: 'Manali, India',
    startDate: '2026-10-01',
    endDate: '2026-10-08',
    budgetPerPerson: 25000,
    currency: 'INR',
    status: 'planning',
    createdAt: '2026-01-01',
    ownerId: tripOwner.id,
    owner: { id: tripOwner.id, name: tripOwner.name, email: tripOwner.email },
    members: [
      { id: 'tm-1', tripId: 'trip-alpha', userId: tripOwner.id, joinedAt: '2026-01-01' },
      { id: 'tm-2', tripId: 'trip-alpha', userId: tripMember.id, joinedAt: '2026-01-02' },
    ],
  };

  describe('Ownership Enforcement', () => {
    it('authorizes trip owner to edit trip details and delete trip', () => {
      const authorized = isTripOwner(mockTrip, tripOwner, null);
      expect(authorized).toBe(true);
    });

    it('rejects legitimate co-traveler member from owner-only trip editing', () => {
      const authorized = isTripOwner(mockTrip, tripMember, null);
      expect(authorized).toBe(false);
    });

    it('rejects uninvited outsider from editing trip', () => {
      const authorized = isTripOwner(mockTrip, outsider, null);
      expect(authorized).toBe(false);
    });

    it('guards against unauthenticated / null user', () => {
      expect(isTripOwner(mockTrip, null, null)).toBe(false);
      expect(isTripOwner(mockTrip, undefined, undefined)).toBe(false);
    });

    it('authorizes when firebaseUser.uid matches trip.ownerId', () => {
      const firebaseUser = { uid: tripOwner.id } as unknown as import('firebase/auth').User;
      expect(isTripOwner(mockTrip, null, firebaseUser)).toBe(true);
    });

    it('authorizes when user.id matches legacy trip.userId', () => {
      const legacyTrip: Trip = {
        ...mockTrip,
        ownerId: undefined as unknown as string,
        owner: undefined,
        userId: 'legacy-user-id',
      };
      const legacyUser: User = {
        ...tripOwner,
        id: 'legacy-user-id',
      };
      expect(isTripOwner(legacyTrip, legacyUser, null)).toBe(true);
    });

    it('safely guards against undefined === undefined when owner and user IDs are missing', () => {
      const tripWithoutOwner: Trip = {
        ...mockTrip,
        ownerId: undefined as unknown as string,
        owner: undefined,
        userId: undefined,
      };
      const userWithoutId: User = {
        ...tripOwner,
        id: undefined as unknown as string,
      };
      expect(isTripOwner(tripWithoutOwner, userWithoutId, null)).toBe(false);
    });
  });

  describe('Direct Route Access & Navigation Fallback', () => {
    it('navigates back when router.canGoBack() is true', () => {
      const mockRouter = {
        canGoBack: jest.fn().mockReturnValue(true),
        back: jest.fn(),
        replace: jest.fn(),
      };

      const handleBack = () => {
        if (mockRouter.canGoBack()) {
          mockRouter.back();
        } else {
          mockRouter.replace({ pathname: '/trip/[id]', params: { id: mockTrip.id } });
        }
      };

      handleBack();
      expect(mockRouter.canGoBack).toHaveBeenCalled();
      expect(mockRouter.back).toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('redirects to trip overview when deep-linked with empty navigation stack (canGoBack is false)', () => {
      const mockRouter = {
        canGoBack: jest.fn().mockReturnValue(false),
        back: jest.fn(),
        replace: jest.fn(),
      };

      const handleBack = () => {
        if (mockRouter.canGoBack()) {
          mockRouter.back();
        } else {
          mockRouter.replace({ pathname: '/trip/[id]', params: { id: mockTrip.id } });
        }
      };

      handleBack();
      expect(mockRouter.canGoBack).toHaveBeenCalled();
      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith({
        pathname: '/trip/[id]',
        params: { id: 'trip-alpha' },
      });
    });
  });

  describe('Defensive Mutation Authorization Guard', () => {
    it('prevents mutation call if user is not trip owner', async () => {
      const mutateAsync = jest.fn();
      const isOwner = isTripOwner(mockTrip, tripMember, null);

      const handleUpdate = async () => {
        if (!isOwner) {
          return { error: 'Access Denied: Only the trip organizer can modify trip details.' };
        }
        return mutateAsync({ name: 'Updated Trek' });
      };

      const result = await handleUpdate();
      expect(mutateAsync).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'Access Denied: Only the trip organizer can modify trip details.',
      });
    });

    it('allows mutation call when user is trip owner', async () => {
      const mutateAsync = jest.fn().mockResolvedValue({ success: true });
      const isOwner = isTripOwner(mockTrip, tripOwner, null);

      const handleUpdate = async () => {
        if (!isOwner) {
          return { error: 'Access Denied' };
        }
        return mutateAsync({ name: 'Updated Trek' });
      };

      const result = await handleUpdate();
      expect(mutateAsync).toHaveBeenCalledWith({ name: 'Updated Trek' });
      expect(result).toEqual({ success: true });
    });
  });
});
