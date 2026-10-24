import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
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
  if (places.length === 0) {
    return (
      <View style={styles.mapEmptyState}>
        <Ionicons name="map-outline" size={32} color={Theme.colors.textMuted} />
        <Text style={styles.mapEmptyTitle}>Map View for {destination}</Text>
        <Text style={styles.mapEmptySubtitle}>
          Add stops to Day {activeDay} to view them on the map.
        </Text>
      </View>
    );
  }

  if (placesWithCoords.length === 0) {
    return (
      <View style={styles.mapEmptyState}>
        <Ionicons name="location-outline" size={32} color={Theme.colors.status.warning} />
        <Text style={styles.mapEmptyTitle}>Location Not Set</Text>
        <Text style={styles.mapEmptySubtitle}>
          Stops in Day {activeDay} do not have valid GPS coordinates yet. Edit stops to set street addresses for automatic plotting.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.realMapWrapper}>
      <MapView
        style={styles.realMapView}
        initialRegion={{
          latitude: placesWithCoords[0].lat!,
          longitude: placesWithCoords[0].lng!,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {placesWithCoords.map((place, idx) => (
          <Marker
            key={place.id || idx}
            coordinate={{ latitude: place.lat!, longitude: place.lng! }}
            title={place.name}
            description={place.address}
          >
            <View style={styles.customMapPin}>
              <Text style={styles.customMapPinText}>{idx + 1}</Text>
            </View>
          </Marker>
        ))}

        {placesWithCoords.length > 1 && (
          <Polyline
            coordinates={placesWithCoords.map((p) => ({
              latitude: p.lat!,
              longitude: p.lng!,
            }))}
            strokeColor={Theme.colors.accent}
            strokeWidth={3}
          />
        )}
      </MapView>

      <View style={styles.mapPlottedOverlay}>
        <Ionicons name="location" size={13} color={Theme.colors.accent} />
        <Text style={styles.mapPlottedText}>
          {placesWithCoords.length} plotted stop(s) • Day {activeDay}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapEmptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  mapEmptySubtitle: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  realMapWrapper: {
    height: 240,
    width: '100%',
    position: 'relative',
  },
  realMapView: {
    width: '100%',
    height: '100%',
  },
  customMapPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.colors.accent,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  customMapPinText: {
    color: Theme.colors.accentText,
    fontSize: 12,
    fontWeight: '800',
  },
  mapPlottedOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 29, 27, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 6,
  },
  mapPlottedText: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
  },
});
