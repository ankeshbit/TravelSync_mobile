import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Trip, TripStatus } from '@/types/trip';

interface TripCardProps {
  trip: Trip;
  onPress: () => void;
}

export function TripCard({ trip, onPress }: TripCardProps) {
  const membersCount = 1 + (trip.members ? trip.members.length : 0);
  const placesCount = trip.places ? trip.places.length : 0;

  const formatDateRange = (start?: string, end?: string) => {
    if (!start) return '';
    try {
      const s = new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const e = end ? new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      return `${s} - ${e}`;
    } catch {
      return `${start} - ${end || ''}`;
    }
  };

  const statusColor = getStatusColor(trip.status);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {trip.coverImageUrl ? (
        <Image
          source={{ uri: trip.coverImageUrl }}
          style={styles.coverImage}
          contentFit="cover"
          transition={300}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="map-outline" size={32} color="#94A3B8" />
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.destination} numberOfLines={1}>{trip.destination}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {trip.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.name} numberOfLines={1}>{trip.name}</Text>

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color="#64748B" />
          <Text style={styles.dateText}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.badge}>
            <Ionicons name="people-outline" size={14} color="#2563EB" />
            <Text style={styles.badgeText}>{membersCount} {membersCount === 1 ? 'member' : 'members'}</Text>
          </View>

          <View style={styles.badge}>
            <Ionicons name="location-outline" size={14} color="#059669" />
            <Text style={styles.badgeText}>{placesCount} {placesCount === 1 ? 'stop' : 'stops'}</Text>
          </View>

          {trip.budgetPerPerson > 0 ? (
            <View style={styles.badge}>
              <Ionicons name="cash-outline" size={14} color="#D97706" />
              <Text style={styles.badgeText}>{trip.currency} {trip.budgetPerPerson}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getStatusColor(status: TripStatus) {
  switch (status) {
    case 'upcoming':
      return { bg: '#EFF6FF', text: '#2563EB' };
    case 'completed':
      return { bg: '#F0FDF4', text: '#16A34A' };
    case 'cancelled':
      return { bg: '#FEF2F2', text: '#DC2626' };
    default:
      return { bg: '#F8FAFC', text: '#475569' };
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  coverImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#E2E8F0',
  },
  imagePlaceholder: {
    width: '100%',
    height: 110,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  destination: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: '#64748B',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
});
