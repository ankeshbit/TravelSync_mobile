import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Place } from '@/types/trip';

interface PlaceCardProps {
  place: Place;
  onDelete?: () => void;
}

export function PlaceCard({ place, onDelete }: PlaceCardProps) {
  const categoryIcon = getCategoryIcon(place.category);

  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons name={categoryIcon} size={20} color="#2563EB" />
      </View>

      <View style={styles.details}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
          {onDelete ? (
            <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {place.address ? (
          <Text style={styles.address} numberOfLines={1}>{place.address}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{place.category || 'attraction'}</Text>
          </View>
          {place.duration ? (
            <Text style={styles.duration}>~{place.duration} mins</Text>
          ) : null}
        </View>

        {place.note ? (
          <View style={styles.noteBox}>
            <Ionicons name="document-text-outline" size={12} color="#64748B" />
            <Text style={styles.noteText}>{place.note}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function getCategoryIcon(category?: string): keyof typeof Ionicons.glyphMap {
  const cat = (category || '').toLowerCase();
  if (cat.includes('food') || cat.includes('restaurant') || cat.includes('cafe')) return 'restaurant-outline';
  if (cat.includes('hotel') || cat.includes('stay') || cat.includes('lodging')) return 'bed-outline';
  if (cat.includes('flight') || cat.includes('airport')) return 'airplane-outline';
  if (cat.includes('nature') || cat.includes('park') || cat.includes('beach')) return 'leaf-outline';
  if (cat.includes('museum') || cat.includes('culture')) return 'color-palette-outline';
  return 'location-outline';
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  details: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  address: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 11,
    color: '#475569',
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  duration: {
    fontSize: 11,
    color: '#94A3B8',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    gap: 4,
  },
  noteText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
    flex: 1,
  },
});
