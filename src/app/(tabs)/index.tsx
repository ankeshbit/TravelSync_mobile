import * as Network from 'expo-network';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTrips, useTripSummary } from '@/hooks/useTrips';
import { StatCard } from '@/components/trips/StatCard';
import { TripCard } from '@/components/trips/TripCard';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { getErrorMessage } from '@/api/client';
import { Trip } from '@/types/trip';
import { Theme } from '@/constants/theme';
import { AiTravelChatbot } from '@/components/common/AiTravelChatbot';

type FilterType = 'All' | 'Upcoming' | 'Past';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, firebaseUser, isInitializing } = useAuth();
  const [aiChatVisible, setAiChatVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('Upcoming');
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let mounted = true;
    const checkNetwork = async () => {
      try {
        const netState = await Network.getNetworkStateAsync();
        if (mounted) {
          setIsOffline(Boolean(netState.isConnected === false || netState.isInternetReachable === false));
        }
      } catch {
        // Fallback gracefully
      }
    };
    checkNetwork();
    const interval = setInterval(checkNetwork, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data: tripsData,
    isLoading: tripsLoading,
    isError: tripsError,
    error: tripsErr,
    refetch: refetchTrips,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTrips(debouncedSearch);

  const {
    data: summary,
    refetch: refetchSummary,
  } = useTripSummary();

  // Redirect to login if unauthenticated or email unverified
  useEffect(() => {
    if (!isInitializing && !firebaseUser) {
      router.replace('/(auth)/login');
    } else if (!isInitializing && firebaseUser && !firebaseUser.emailVerified) {
      router.replace('/(auth)/verify-email');
    }
  }, [firebaseUser, isInitializing, router]);

  const onRefresh = async () => {
    await Promise.all([refetchTrips(), refetchSummary()]);
  };

  const trips = useMemo(() => {
    return tripsData?.pages.flatMap((page) => page?.trips || []) || [];
  }, [tripsData]);
  const displayName = user?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Traveler';

  // Filtered trips list matching website DashboardView.vue
  const displayTrips = useMemo(() => {
    let list = Array.isArray(trips) ? trips : [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          (t.name && t.name.toLowerCase().includes(q)) ||
          (t.destination && t.destination.toLowerCase().includes(q))
      );
    }

    if (activeFilter === 'Upcoming') {
      return list.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
    } else if (activeFilter === 'Past') {
      return list.filter((t) => t.status === 'completed' || t.status === 'cancelled');
    }

    return list;
  }, [trips, searchQuery, activeFilter]);

  // Total spent multi-currency formatter matching website formatCurrency
  const formattedTotalSpent = useMemo(() => {
    if (summary?.spentByCurrency && typeof summary.spentByCurrency === 'object') {
      const entries = Object.entries(summary.spentByCurrency).filter(
        ([, amt]) => typeof amt === 'number' && (amt as number) > 0
      );
      if (entries.length > 1) {
        return entries.map(([curr, amt]) => `${curr} ${Number(amt).toLocaleString()}`).join(' + ');
      }
      if (entries.length === 1) {
        const [curr, amt] = entries[0];
        return `${curr} ${Number(amt).toLocaleString()}`;
      }
    }
    const curr = summary?.currency || 'INR';
    const total = summary?.totalSpent ?? 0;
    return `${curr} ${Number(total).toLocaleString()}`;
  }, [summary]);

  if (isInitializing) {
    return <LoadingState message="Checking TravelSync session..." fullscreen />;
  }

  const renderHeader = () => {
    return (
      <View style={styles.headerContainer}>
        {/* User Greeting & CTA */}
        {/* Offline Connectivity Banner */}
        {isOffline ? (
          <TouchableOpacity
            style={styles.offlineBanner}
            onPress={() => router.push('/trip/offline')}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-offline-outline" size={20} color={Theme.colors.status.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineBannerTitle}>You are currently offline</Text>
              <Text style={styles.offlineBannerSubtitle}>Access your saved offline trip packs</Text>
            </View>
            <View style={styles.offlineBannerBtn}>
              <Text style={styles.offlineBannerBtnText}>View</Text>
              <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={styles.topRow}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{displayName}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.savedOfflineHeaderBtn}
              onPress={() => router.push('/trip/offline')}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-offline-outline" size={15} color={Theme.colors.accent} />
              <Text style={styles.savedOfflineHeaderBtnText}>Saved Offline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/trip/create')}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color={Theme.colors.accentText} />
              <Text style={styles.createButtonText}>New Trip</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Overview Stat Cards */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Total Trips"
            value={summary?.totalTrips ?? trips.length}
            icon="airplane"
            color={Theme.colors.accent}
            bgColor="rgba(167, 169, 154, 0.12)"
          />
          <StatCard
            label="Upcoming"
            value={summary?.upcomingTrips ?? 0}
            icon="calendar"
            color={Theme.colors.status.success}
            bgColor="rgba(134, 169, 139, 0.12)"
          />
        </View>
        <View style={styles.statsGrid}>
          <StatCard
            label="Co-Travelers"
            value={summary?.totalMembers ?? 1}
            icon="people"
            color={Theme.colors.status.info}
            bgColor="rgba(152, 166, 160, 0.12)"
          />
          <StatCard
            label="Total Spent"
            value={formattedTotalSpent}
            icon="wallet"
            color={Theme.colors.status.warning}
            bgColor="rgba(196, 163, 107, 0.12)"
          />
        </View>

        {/* Search Bar matching website */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Theme.colors.textMuted} />
          <TextInput
            placeholder="Search trips by name or destination..."
            placeholderTextColor={Theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Pills matching website DashboardView */}
        <View style={styles.filterPillsRow}>
          {(['All', 'Upcoming', 'Past'] as FilterType[]).map((tab) => {
            const isActive = activeFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setActiveFilter(tab)}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {tab === 'All' ? 'All Trips' : tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {activeFilter === 'All' ? 'All Trips' : `${activeFilter} Trips`}
          </Text>
          <Text style={styles.sectionCount}>{displayTrips.length} found</Text>
        </View>
      </View>
    );
  };

  if (tripsLoading && !isRefetching) {
    return <LoadingState message="Fetching your trips from TravelSync..." fullscreen />;
  }

  if (tripsError && trips.length === 0) {
    return (
      <View style={styles.errorScreenWrapper}>
        <ErrorState
          title="Failed to Load Trips"
          message={getErrorMessage(tripsErr)}
          onRetry={onRefresh}
        />
        <View style={styles.offlineEntryContainer}>
          <Text style={styles.offlineEntryText}>Looking for trips saved on this device?</Text>
          <TouchableOpacity
            style={styles.savedOfflineButton}
            onPress={() => router.push('/trip/offline')}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-offline-outline" size={18} color="#FFFFFF" />
            <Text style={styles.savedOfflineButtonText}>Saved Offline Trips</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={displayTrips}
        keyExtractor={(item: Trip) => item.id}
        renderItem={({ item }: { item: Trip }) => (
          <TripCard
            trip={item}
            onPress={() => router.push({ pathname: '/trip/[id]', params: { id: item.id } })}
          />
        )}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={Theme.colors.accent} />
            </View>
          ) : undefined
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          searchQuery ? (
            <EmptyState
              icon="search-outline"
              title="No Matching Trips Found"
              message={`No trips match "${searchQuery}". Check your keywords or try searching for another destination.`}
              actionLabel="Clear Search"
              onAction={() => setSearchQuery('')}
            />
          ) : activeFilter !== 'All' ? (
            <EmptyState
              icon="calendar-outline"
              title={`No ${activeFilter.toLowerCase()} trips`}
              message={`You don't have any ${activeFilter.toLowerCase()} trips scheduled right now.`}
              actionLabel="Plan a Trip"
              onAction={() => router.push('/trip/create')}
            />
          ) : (
            <EmptyState
              icon="airplane-outline"
              title="No Trips Yet"
              message="You haven't planned any trips yet. Create your first adventure and start inviting your travel companions!"
              actionLabel="Plan a Trip"
              onAction={() => router.push('/trip/create')}
            />
          )
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={[Theme.colors.accent]}
            tintColor={Theme.colors.accent}
          />
        }
      />

      {/* Floating AI Guide Button (matching website TravelChatbot) */}
      <TouchableOpacity
        style={styles.floatingAiBtn}
        onPress={() => setAiChatVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="sparkles" size={18} color={Theme.colors.accentText} />
        <Text style={styles.floatingAiText}>AI Guide</Text>
      </TouchableOpacity>

      {/* AI Travel Recommendation Assistant Modal */}
      <AiTravelChatbot
        visible={aiChatVisible}
        onClose={() => setAiChatVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  errorScreenWrapper: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  offlineEntryContainer: {
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
  },
  offlineEntryText: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    marginBottom: 10,
    textAlign: 'center',
  },
  savedOfflineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
  },
  savedOfflineButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  offlineBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.status.warning,
  },
  offlineBannerSubtitle: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  offlineBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.status.warning,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  offlineBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  savedOfflineHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  savedOfflineHeaderBtnText: {
    color: Theme.colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  footerOfflineEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
  },
  footerOfflineEntryText: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    fontWeight: '500',
  },
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 4,
  },
  greeting: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    fontWeight: '500',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  createButtonText: {
    color: Theme.colors.accentText,
    fontWeight: '700',
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Theme.colors.textPrimary,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  filterPillActive: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  filterPillTextActive: {
    color: Theme.colors.accentText,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  sectionCount: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    fontWeight: '500',
  },
  floatingAiBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  floatingAiText: {
    color: Theme.colors.accentText,
    fontSize: 13,
    fontWeight: '700',
  },
});
