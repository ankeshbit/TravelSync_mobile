import { useEffect, useState, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { auth } from '@/config/firebase';
import { getSocketBaseUrl } from '@/config/env';

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

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
    });

    // Real-time Presence
    socketInstance.on('presence:list', (list: any[]) => {
      const formatted = (Array.isArray(list) ? list : []).map((u) => ({
        userId: u.id || u.userId,
        name: u.name || 'Member',
      }));
      setActiveMembers(formatted);
    });

    socketInstance.on('user:joined', (user: any) => {
      const uid = user.id || user.userId;
      setActiveMembers((prev) => {
        if (prev.some((m) => m.userId === uid)) return prev;
        return [...prev, { userId: uid, name: user.name || 'Member' }];
      });
    });

    socketInstance.on('user:left', (data: any) => {
      const uid = data.userId || data.id;
      setActiveMembers((prev) => prev.filter((m) => m.userId !== uid));
    });

    // Real-time Places & Itinerary
    socketInstance.on('place:added', () => {
      queryClient.invalidateQueries({ queryKey: ['tripPlaces', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      callbacksRef.current?.onPlaceAdded?.();
    });

    socketInstance.on('place:deleted', () => {
      queryClient.invalidateQueries({ queryKey: ['tripPlaces', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      callbacksRef.current?.onPlaceDeleted?.();
    });

    socketInstance.on('place:reordered', () => {
      queryClient.invalidateQueries({ queryKey: ['tripPlaces', tripId] });
      callbacksRef.current?.onPlaceReordered?.();
    });

    socketInstance.on('place:note_updated', () => {
      queryClient.invalidateQueries({ queryKey: ['tripPlaces', tripId] });
      callbacksRef.current?.onPlaceNoteUpdated?.();
    });

    // Real-time Expenses & Balances
    socketInstance.on('expense:added', () => {
      queryClient.invalidateQueries({ queryKey: ['tripExpenses', tripId] });
      queryClient.invalidateQueries({ queryKey: ['tripBalances', tripId] });
      queryClient.invalidateQueries({ queryKey: ['tripSummary'] });
      callbacksRef.current?.onExpenseAdded?.();
    });

    socketInstance.on('expense:deleted', () => {
      queryClient.invalidateQueries({ queryKey: ['tripExpenses', tripId] });
      queryClient.invalidateQueries({ queryKey: ['tripBalances', tripId] });
      queryClient.invalidateQueries({ queryKey: ['tripSummary'] });
      callbacksRef.current?.onExpenseDeleted?.();
    });

    // Real-time Membership & Trip Meta
    socketInstance.on('member:joined', () => {
      queryClient.invalidateQueries({ queryKey: ['tripMembers', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      callbacksRef.current?.onMemberJoined?.();
    });

    socketInstance.on('trip:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['tripSummary'] });
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
      setActiveMembers([]);
    };
  }, [tripId, queryClient, router]);

  return {
    activeMembers,
    isConnected,
  };
}
