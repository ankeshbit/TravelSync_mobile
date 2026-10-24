import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
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
  const initialRegion = useMemo(() => {
    if (placesWithCoords.length > 0 && typeof placesWithCoords[0].lat === 'number' && typeof placesWithCoords[0].lng === 'number') {
      return {
        latitude: placesWithCoords[0].lat,
        longitude: placesWithCoords[0].lng,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }
    return {
      latitude: 20.5937,
      longitude: 78.9629,
      latitudeDelta: 10,
      longitudeDelta: 10,
    };
  }, [placesWithCoords]);

  if (placesWithCoords.length === 0) {
    return (
      <View style={styles.emptyMapContainer}>
        <Ionicons name="map-outline" size={32} color={Theme.colors.accent} />
        <Text style={styles.mapTitle}>Day ${activeDay} Map</Text>
        <Text style={styles.mapSubtitle}>
          {places.length > 0
            ? `${places.length} stop(s) added. Add street addresses to plot pins on the map.`
            : `No places added for Day ${activeDay}. Tap "Add Place" to begin.`}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion}>
        {placesWithCoords.map((place, index) => (
          <Marker
            key={place.id || String(index)}
            coordinate={{
              latitude: place.lat!,
              longitude: place.lng!,
            }}
            title={place.name}
            description={place.address || undefined}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  emptyMapContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  mapSubtitle: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
