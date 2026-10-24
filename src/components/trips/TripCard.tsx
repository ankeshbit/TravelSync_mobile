import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Trip, TripStatus } from '@/types/trip';
import { formatDateRange } from '@/utils/dateUtils';
import { Theme } from '@/constants/theme';

interface TripCardProps {
  trip: Trip;
  onPress: () => void;
}

export function TripCard({ trip, onPress }: TripCardProps) {
  const membersCount = 1 + (trip.members ? trip.members.length : 0);
  const placesCount = trip.places ? trip.places.length : 0;



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
          <Ionicons name="map-outline" size={32} color={Theme.colors.textMuted} />
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
          <Ionicons name="calendar-outline" size={14} color={Theme.colors.textMuted} />
          <Text style={styles.dateText}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.badge}>
            <Ionicons name="people-outline" size={13} color={Theme.colors.accent} />
            <Text style={styles.badgeText}>{membersCount} {membersCount === 1 ? 'member' : 'members'}</Text>
          </View>

          <View style={styles.badge}>
            <Ionicons name="location-outline" size={13} color={Theme.colors.status.success} />
            <Text style={styles.badgeText}>{placesCount} {placesCount === 1 ? 'stop' : 'stops'}</Text>
          </View>

          {trip.budgetPerPerson > 0 ? (
            <View style={styles.badge}>
              <Ionicons name="cash-outline" size={13} color={Theme.colors.status.warning} />
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
      return { bg: Theme.colors.status.successBg, text: Theme.colors.status.success };
    case 'completed':
      return { bg: Theme.colors.status.infoBg, text: Theme.colors.status.info };
    case 'cancelled':
      return { bg: Theme.colors.status.errorBg, text: Theme.colors.status.error };
    default:
      return { bg: Theme.colors.accentMuted, text: Theme.colors.accent };
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 16,
  },
  coverImage: {
    width: '100%',
    height: 140,
    backgroundColor: Theme.colors.surfaceElevated,
  },
  imagePlaceholder: {
    width: '100%',
    height: 110,
    backgroundColor: Theme.colors.surfaceElevated,
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
    marginBottom: 6,
  },
  destination: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.borderRadius.xs,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    color: Theme.colors.textPrimary,
    fontWeight: '500',
  },
});
