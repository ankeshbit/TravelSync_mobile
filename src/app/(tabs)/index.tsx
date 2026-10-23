import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
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

export default function DashboardScreen() {
  const router = useRouter();
  const { user, firebaseUser, isInitializing } = useAuth();
  const [aiChatVisible, setAiChatVisible] = React.useState(false);

  const {
    data: tripsData,
    isLoading: tripsLoading,
    isError: tripsError,
    error: tripsErr,
    refetch: refetchTrips,
    isRefetching,
  } = useTrips();

  const {
    data: summary,
    refetch: refetchSummary,
  } = useTripSummary();

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!isInitializing && !firebaseUser) {
      router.replace('/(auth)/login');
    }
  }, [firebaseUser, isInitializing, router]);

  const onRefresh = async () => {
    await Promise.all([refetchTrips(), refetchSummary()]);
  };

  if (isInitializing) {
    return <LoadingState message="Checking TravelSync session..." fullscreen />;
  }

  const trips = tripsData?.trips || [];
  const displayName = user?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Traveler';

  const renderHeader = () => {
    const totalSpentDisplay = summary?.totalSpent !== null && summary?.totalSpent !== undefined
      ? `${summary?.currency || 'INR'} ${summary.totalSpent.toLocaleString()}`
      : (summary?.hasMultipleCurrencies ? 'Multi-Curr' : '0');

    return (
      <View style={styles.headerContainer}>
        {/* User Greeting & CTA */}
        <View style={styles.topRow}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{displayName}</Text>
          </View>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/trip/create')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color={Theme.colors.accentText} />
            <Text style={styles.createButtonText}>New Trip</Text>
          </TouchableOpacity>
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
            value={totalSpentDisplay}
            icon="wallet"
            color={Theme.colors.status.warning}
            bgColor="rgba(196, 163, 107, 0.12)"
          />
        </View>

        {/* Trips Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Trips</Text>
          <Text style={styles.sectionCount}>{trips.length} total</Text>
        </View>
      </View>
    );
  };

  if (tripsLoading && !isRefetching) {
    return <LoadingState message="Fetching your trips from TravelSync..." fullscreen />;
  }

  if (tripsError && trips.length === 0) {
    return (
      <ErrorState
        title="Failed to Load Trips"
        message={getErrorMessage(tripsErr)}
        onRetry={onRefresh}
        fullscreen
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={trips}
        keyExtractor={(item: Trip) => item.id}
        renderItem={({ item }: { item: Trip }) => (
          <TripCard
            trip={item}
            onPress={() => router.push({ pathname: '/trip/[id]', params: { id: item.id } })}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <EmptyState
            icon="airplane-outline"
            title="No Trips Found"
            message="You haven't created or joined any trips yet. Start planning your next adventure!"
            actionLabel="Plan a Trip"
            onAction={() => router.push('/trip/create')}
          />
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
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
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
