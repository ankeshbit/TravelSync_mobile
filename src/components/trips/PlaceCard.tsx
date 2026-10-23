import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Place } from '@/types/trip';
import { Theme } from '@/constants/theme';

interface PlaceCardProps {
  place: Place;
  onDelete?: () => void;
  onEditNote?: () => void;
}

export function PlaceCard({ place, onDelete, onEditNote }: PlaceCardProps) {
  const categoryIcon = getCategoryIcon(place.category);

  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons name={categoryIcon} size={18} color={Theme.colors.accent} />
      </View>

      <View style={styles.details}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {onEditNote ? (
              <TouchableOpacity onPress={onEditNote} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="create-outline" size={16} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
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
            <Ionicons name="document-text-outline" size={12} color={Theme.colors.textMuted} />
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
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
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
    color: Theme.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  address: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.xs,
  },
  categoryText: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  duration: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
    marginTop: 6,
    gap: 6,
  },
  noteText: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
});
