import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Place } from '@/types/trip';
import { Theme } from '@/constants/theme';

export interface TripMapViewProps {
  destination: string;
  activeDay: number;
  places: Place[];
  placesWithCoords: Place[];
}

export function TripMapView({
  destination,
  activeDay,
  places,
  placesWithCoords,
}: TripMapViewProps) {
  return (
    <View style={styles.webMapFallback}>
      <Ionicons name="map-outline" size={32} color={Theme.colors.accent} />
      <Text style={styles.webMapTitle}>Day {activeDay} Itinerary Map</Text>
      <Text style={styles.webMapSubtitle}>
        {placesWithCoords.length > 0
          ? `${placesWithCoords.length} plotted location(s) in ${destination}. Interactive map rendering is active on iOS & Android devices.`
          : `${places.length} stop(s) scheduled for Day ${activeDay}. Add addresses to plot them on the map.`}
      </Text>
      <View style={styles.webPinsRow}>
        {places.map((p, idx) => (
          <View key={p.id || idx} style={styles.webPinChip}>
            <Text style={styles.webPinNum}>{idx + 1}</Text>
            <Text style={styles.webPinText} numberOfLines={1}>{p.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webMapFallback: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webMapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  webMapSubtitle: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  webPinsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  webPinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  webPinNum: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.accent,
  },
  webPinText: {
    fontSize: 12,
    color: Theme.colors.textPrimary,
    maxWidth: 120,
  },
});
