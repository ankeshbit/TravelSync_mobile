import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useExploreDestinations } from '@/hooks/useTrips';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Theme } from '@/constants/theme';
import { ExploreDestination } from '@/types/trip';

export default function ExploreScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const {
    data: destinations = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useExploreDestinations(debouncedQuery);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    // Simple debounce trigger
    setDebouncedQuery(text.trim());
  };

  const handlePlanDestination = (destName: string) => {
    router.push({
      pathname: '/trip/create',
      params: { destination: destName },
    });
  };

  if (isLoading && !isRefetching) {
    return <LoadingState message="Discovering top destinations..." fullscreen />;
  }

  if (isError && destinations.length === 0) {
    return (
      <ErrorState
        title="Failed to Load Destinations"
        message="Could not load community travel destinations. Please try again."
        onRetry={refetch}
        fullscreen
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Theme.colors.textMuted} />
          <TextInput
            placeholder="Search popular destinations..."
            placeholderTextColor={Theme.colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={destinations}
        keyExtractor={(item: ExploreDestination) => item.name}
        renderItem={({ item }: { item: ExploreDestination }) => (
          <View style={styles.card}>
            {item.coverImageUrl ? (
              <Image source={{ uri: item.coverImageUrl }} style={styles.cardImage} contentFit="cover" />
            ) : (
              <View style={styles.cardImagePlaceholder}>
                <Ionicons name="earth-outline" size={36} color={Theme.colors.textMuted} />
              </View>
            )}

            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.destName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.tripCountBadge}>
                  <Ionicons name="airplane-outline" size={12} color={Theme.colors.accent} />
                  <Text style={styles.tripCountText}>
                    {item.tripCount} {item.tripCount === 1 ? 'trip' : 'trips'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.budgetLabel}>Avg Budget / Person</Text>
                  <Text style={styles.budgetValue}>
                    {item.averageBudgetPerPerson > 0
                      ? `INR ${item.averageBudgetPerPerson.toLocaleString()}`
                      : 'Flexible'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.planBtn}
                  onPress={() => handlePlanDestination(item.name)}
                >
                  <Ionicons name="add" size={16} color={Theme.colors.accentText} />
                  <Text style={styles.planBtnText}>Plan Trip</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="compass-outline"
            title="No Destinations Found"
            message={
              searchQuery
                ? `No destinations match "${searchQuery}". Try a different search.`
                : 'As you and your travel companions plan trips, popular destinations will appear here.'
            }
          />
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
            }}
            colors={[Theme.colors.accent]}
            tintColor={Theme.colors.accent}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: Theme.colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Theme.colors.textPrimary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cardImage: {
    width: '100%',
    height: 140,
    backgroundColor: Theme.colors.surfaceElevated,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: Theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  destName: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  tripCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(167, 169, 154, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  tripCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.accent,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  budgetLabel: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  budgetValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  planBtnText: {
    color: Theme.colors.accentText,
    fontSize: 12,
    fontWeight: '700',
  },
});
