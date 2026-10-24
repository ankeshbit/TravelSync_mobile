import { useEffect, useState, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { auth } from '@/config/firebase';
import { getSocketBaseUrl } from '@/config/env';
import { TRIP_KEYS } from './useTrips';

export interface ActiveMember {
  userId: string;
  name: string;
}

export interface UseTripSocketCallbacks {
  onPlaceAdded?: () => void;
  onPlaceDeleted?: () => void;
  onPlaceReordered?: () => void;
  onPlaceNoteUpdated?: () => void;
  onExpenseAdded?: () => void;
  onExpenseDeleted?: () => void;
  onMemberJoined?: () => void;
  onTripUpdated?: () => void;
}

export function useTripSocket(
  tripId: string | undefined | null,
  callbacks?: UseTripSocketCallbacks
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const callbacksRef = useRef<UseTripSocketCallbacks | undefined>(callbacks);
  const userConnectionCountsRef = useRef<Map<string, { count: number; name: string }>>(new Map());

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!tripId) {
      return;
    }

    const socketUrl = getSocketBaseUrl();

    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: async (cb: (data: { token: string | null }) => void) => {
        try {
          const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
          cb({ token });
        } catch {
          cb({ token: null });
        }
      },
      query: { tripId },
    });

    const syncActiveMembers = () => {
      const members: ActiveMember[] = [];
      userConnectionCountsRef.current.forEach((val, userId) => {
        if (val.count > 0) {
          members.push({ userId, name: val.name });
        }
      });
      setActiveMembers(members);
    };

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
    });

    // Real-time Presence with connection counting & deduplication
    socketInstance.on('presence:list', (list: any[]) => {
      const map = new Map<string, { count: number; name: string }>();
      if (Array.isArray(list)) {
        for (const u of list) {
          const uid = u?.id || u?.userId;
          if (!uid) continue;
          const existing = map.get(uid);
          if (existing) {
            existing.count += 1;
          } else {
            map.set(uid, { count: 1, name: u.name || 'Member' });
          }
        }
      }
      userConnectionCountsRef.current = map;
      syncActiveMembers();
    });

    socketInstance.on('user:joined', (user: any) => {
      const uid = user?.id || user?.userId;
      if (!uid) return;
      const name = user?.name || 'Member';
      const existing = userConnectionCountsRef.current.get(uid);
      if (existing) {
        existing.count += 1;
        existing.name = name;
      } else {
        userConnectionCountsRef.current.set(uid, { count: 1, name });
      }
      syncActiveMembers();
    });

    socketInstance.on('user:left', (data: any) => {
      const uid = data?.userId || data?.id;
      if (!uid) return;
      const existing = userConnectionCountsRef.current.get(uid);
      if (existing) {
        existing.count -= 1;
        if (existing.count <= 0) {
          userConnectionCountsRef.current.delete(uid);
        }
      }
      syncActiveMembers();
    });

    // Real-time Places & Itinerary
    socketInstance.on('place:added', () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.places(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });
      callbacksRef.current?.onPlaceAdded?.();
    });

    socketInstance.on('place:deleted', () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.places(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });
      callbacksRef.current?.onPlaceDeleted?.();
    });

    socketInstance.on('place:reordered', () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.places(tripId) });
      callbacksRef.current?.onPlaceReordered?.();
    });

    socketInstance.on('place:note_updated', () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.places(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      callbacksRef.current?.onPlaceNoteUpdated?.();
    });

    // Real-time Expenses & Balances
    socketInstance.on('expense:added', () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.expenses(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.balances(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.summary() });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });
      callbacksRef.current?.onExpenseAdded?.();
    });

    socketInstance.on('expense:deleted', () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.expenses(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.balances(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.summary() });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });
      callbacksRef.current?.onExpenseDeleted?.();
    });

    // Real-time Membership & Trip Meta
    socketInstance.on('member:joined', () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.members(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });
      callbacksRef.current?.onMemberJoined?.();
    });

    socketInstance.on('trip:updated', () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.summary() });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });
      callbacksRef.current?.onTripUpdated?.();
    });

    let hasExited = false;

    socketInstance.on('trip:deleted', () => {
      if (hasExited) return;
      hasExited = true;
      Alert.alert('Trip Removed', 'This trip has been deleted by the owner.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    });

    socketInstance.on('trip:removed', () => {
      if (hasExited) return;
      hasExited = true;
      Alert.alert('Access Revoked', 'You have been removed from this trip.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    });

    return () => {
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
      setIsConnected(false);
      userConnectionCountsRef.current.clear();
      setActiveMembers([]);
    };
  }, [tripId, queryClient, router]);

  return {
    activeMembers,
    isConnected,
  };
}
