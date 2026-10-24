import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useIsTripOwner } from '@/hooks/useIsTripOwner';
import { geocodePlace } from '@/utils/geocoding';
import { formatDateRange, calculateTripDays } from '@/utils/dateUtils';
import { filterTripMembers, getTripMemberCount } from '@/utils/tripMembers';
import { getErrorMessage } from '@/api/client';
import {
  useTrip,
  useTripPlaces,
  useAddTripPlace,
  useDeleteTripPlace,
  useUpdatePlaceNote,
  useTripExpenses,
  useTripMembers,
  useAddTripMember,
  useRemoveTripMember,
  useLeaveTrip,
  useAiTripSuggestions,
} from '@/hooks/useTripDetails';
import { PlaceCard } from '@/components/trips/PlaceCard';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { BottomSheetModal } from '@/components/common/BottomSheetModal';
import { Place, Expense, AiSuggestion } from '@/types/trip';
import { Theme } from '@/constants/theme';
import { useTripSocket } from '@/hooks/useTripSocket';
import { TripPresence } from '@/components/trips/TripPresence';

export default function TripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // useIsTripOwner handles user authorization checks

  const [activeTab, setActiveTab] = useState<'itinerary' | 'overview'>('itinerary');

  // Add Place Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeDay, setPlaceDay] = useState('1');
  const [placeCategory, setPlaceCategory] = useState('attraction');
  const [placeDuration, setPlaceDuration] = useState('60');
  const [placeNote, setPlaceNote] = useState('');

  // Edit Note Modal state
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Add Member Modal state
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');

  // AI Suggestions Modal state
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  // M5: Track added suggestion names to prevent duplicates
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());

  const {
    data: trip,
    isLoading: tripLoading,
    isError: tripError,
    refetch: refetchTrip,
    isRefetching,
  } = useTrip(id || '');

  const {
    data: places,
    isLoading: placesLoading,
    isError: placesError,
    refetch: refetchPlaces,
  } = useTripPlaces(id || '');

  const {
    data: expenses,
    isError: expensesError,
    refetch: refetchExpenses,
  } = useTripExpenses(id || '');

  const {
    data: members,
    isError: membersError,
    refetch: refetchMembers,
  } = useTripMembers(id || '');

  // Real-time Socket.IO collaboration with automatic TanStack Query invalidation
  const { activeMembers: socketMembers } = useTripSocket(id || '');

  const addPlaceMutation = useAddTripPlace(id || '');
  const deletePlaceMutation = useDeleteTripPlace(id || '');
  const updateNoteMutation = useUpdatePlaceNote(id || '');
  const addMemberMutation = useAddTripMember(id || '');
  const removeMemberMutation = useRemoveTripMember(id || '');
  const leaveTripMutation = useLeaveTrip(id || '');
  const aiSuggestionsMutation = useAiTripSuggestions(id || '');

  const onRefresh = async () => {
    await Promise.all([
      refetchTrip(),
      refetchPlaces(),
      refetchExpenses(),
      refetchMembers(),
    ]);
  };

  const isOwner = useIsTripOwner(trip);

  const handleAddPlace = async () => {
    if (!placeName.trim()) {
      Alert.alert('Required', 'Please enter a name for this place or activity.');
      return;
    }

    try {
      const coords = await geocodePlace(placeAddress.trim() || placeName.trim(), trip?.destination);

      await addPlaceMutation.mutateAsync({
        name: placeName.trim(),
        address: placeAddress.trim() || 'General area',
        ...(coords.lat !== undefined && coords.lng !== undefined ? { lat: coords.lat, lng: coords.lng } : {}),
        dayNumber: parseInt(placeDay, 10) || 1,
        category: placeCategory,
        duration: parseInt(placeDuration, 10) || 60,
        note: placeNote.trim(),
      });

      setModalVisible(false);
      setPlaceName('');
      setPlaceAddress('');
      setPlaceNote('');
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  const handleDeletePlace = (place: Place) => {
    Alert.alert('Delete Stop', `Remove "${place.name}" from the itinerary?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deletePlaceMutation.mutate(place.id, {
            onError: (err: unknown) =>
              Alert.alert('Error', getErrorMessage(err)),
          }),
      },
    ]);
  };

  const handleOpenEditNote = (place: Place) => {
    setEditingPlace(place);
    setEditingNoteText(place.note || '');
  };

  const handleSaveNote = async () => {
    if (!editingPlace) return;
    try {
      await updateNoteMutation.mutateAsync({
        placeId: editingPlace.id,
        note: editingNoteText.trim(),
      });
      setEditingPlace(null);
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  const handleAddMember = async () => {
    if (!memberEmail.trim()) {
      Alert.alert('Required', 'Please enter an email address to invite.');
      return;
    }

    try {
      await addMemberMutation.mutateAsync(memberEmail.trim());
      setMemberModalVisible(false);
      setMemberEmail('');
      Alert.alert('Success', `Invited ${memberEmail} to join the trip.`);
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  const handleRemoveMember = (memberUserId: string, memberName: string) => {
    Alert.alert('Remove Member', `Remove ${memberName} from this trip?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMemberMutation.mutateAsync(memberUserId);
          } catch (err: unknown) {
            Alert.alert('Error', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  const handleLeaveTrip = () => {
    Alert.alert('Leave Trip', 'Are you sure you want to leave this trip? You will lose access to its itinerary and expenses.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave Trip',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveTripMutation.mutateAsync();
            router.replace('/(tabs)');
          } catch (err: unknown) {
            Alert.alert('Error', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  const handleLoadAiSuggestions = async (forceRegenerate: boolean | unknown = false) => {
    const shouldForce = forceRegenerate === true;
    setAiModalVisible(true);
    if (aiSuggestions.length > 0 && !shouldForce) return;

    try {
      setLoadingAi(true);
      const res = await aiSuggestionsMutation.mutateAsync();
      setAiSuggestions(Array.isArray(res) ? res : (res as any)?.suggestions || []);
    } catch (err: unknown) {
      Alert.alert('AI Guide Error', getErrorMessage(err));
    } finally {
      setLoadingAi(false);
    }
  };

  const handleAddAiSuggestionToTrip = async (sug: AiSuggestion) => {
    const sugKey = sug.title || sug.name || '';
    if (addedSuggestions.has(sugKey)) {
      Alert.alert('Already Added', `"${sugKey}" is already in the itinerary.`);
      return;
    }
    try {
      const coords = await geocodePlace(sug.location || sug.title || sug.name || '', trip?.destination);

      await addPlaceMutation.mutateAsync({
        name: sug.title || sug.name || 'AI Activity',
        address: sug.location || trip?.destination || 'Destination Area',
        ...(coords.lat !== undefined && coords.lng !== undefined ? { lat: coords.lat, lng: coords.lng } : {}),
        dayNumber: sug.dayNumber || 1,
        category: sug.category || 'attraction',
        duration: sug.duration || 60,
        note: sug.description || '',
      });
      setAddedSuggestions((prev) => new Set(prev).add(sugKey));
      Alert.alert('Added', `"${sug.title || sug.name}" added to itinerary!`);
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  if (tripLoading) {
    return <LoadingState message="Loading trip details..." fullscreen />;
  }

  if (tripError || !trip) {
    return (
      <ErrorState
        title="Trip Not Found"
        message="Could not load this trip. It may have been removed or you may lack membership permissions."
        onRetry={onRefresh}
        fullscreen
      />
    );
  }

  // Group places by dayNumber
  const groupedPlaces = (places || []).reduce<Record<number, Place[]>>((acc, place) => {
    const day = place.dayNumber || 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push(place);
    return acc;
  }, {});

  const dayNumbers = Object.keys(groupedPlaces)
    .map(Number)
    .sort((a, b) => a - b);

  // Sum only expenses matching trip currency for the overview stat
  const totalExpenseSum = (expenses || []).reduce((acc: number, curr: Expense) => {
    const expCurr = (curr.currency || trip.currency || 'USD').toUpperCase();
    const tripCurr = (trip.currency || 'USD').toUpperCase();
    return expCurr === tripCurr ? acc + (Number(curr.amount) || 0) : acc;
  }, 0);
  const activeMembers = filterTripMembers(members || trip.members, trip.ownerId);
  const totalMemberCount = getTripMemberCount(members || trip.members, trip.ownerId);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={[Theme.colors.accent]}
            tintColor={Theme.colors.accent}
          />
        }
      >
        {/* Hero Banner with Cover Photo */}
        <View style={styles.heroContainer}>
          {trip.coverImageUrl ? (
            <Image source={{ uri: trip.coverImageUrl }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]} />
          )}
          <View style={styles.heroOverlay} />

          {/* Quick Header Action Icons & Live Presence */}
          <View style={styles.headerFloatingActions}>
            <TripPresence activeMembers={socketMembers} />
            {isOwner ? (
              <TouchableOpacity
                style={styles.floatingActionBtn}
                onPress={() => router.push({ pathname: '/trip/edit', params: { id } })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="create-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.tripName}>{trip.name}</Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaItem}>
                <Ionicons name="location" size={14} color={Theme.colors.accent} />
                <Text style={styles.heroMetaText} numberOfLines={1}>{trip.destination}</Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Ionicons name="calendar-outline" size={14} color={Theme.colors.textSecondary} />
                <Text style={styles.heroMetaText}>
                  {formatDateRange(trip.startDate, trip.endDate)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions Row */}
        <View style={styles.quickActionsBar}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push({ pathname: '/trip/map', params: { tripId: id } })}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(167, 169, 154, 0.15)' }]}>
              <Ionicons name="map-outline" size={20} color={Theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickActionTitle}>Map & Planner</Text>
              <Text style={styles.quickActionSub}>Day-by-day routes</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push({ pathname: '/trip/offline', params: { tripId: id } })}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(217, 119, 6, 0.15)' }]}>
              <Ionicons name="cloud-offline-outline" size={20} color={Theme.colors.status.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickActionTitle}>Offline Companion</Text>
              <Text style={styles.quickActionSub}>Airplane mode ready</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push({ pathname: '/trip/expenses', params: { tripId: id } })}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(134, 169, 139, 0.15)' }]}>
              <Ionicons name="wallet-outline" size={20} color={Theme.colors.status.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickActionTitle}>Expenses & Debts</Text>
              <Text style={styles.quickActionSub}>
                {expensesError ? 'Error loading expenses' : `${trip.currency} ${totalExpenseSum.toLocaleString()} spent`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleLoadAiSuggestions}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(167, 169, 154, 0.15)' }]}>
              <Ionicons name="sparkles" size={20} color={Theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickActionTitle}>AI Travel Guide</Text>
              <Text style={styles.quickActionSub}>Smart suggestions</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* 4 Stat Widgets Row */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={18} color={Theme.colors.textMuted} />
            <Text style={styles.statValue}>{totalMemberCount}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={18} color={Theme.colors.textMuted} />
            <Text style={styles.statValue}>
              {trip.currency} {trip.budgetPerPerson ? Number(trip.budgetPerPerson).toLocaleString() : '—'}
            </Text>
            <Text style={styles.statLabel}>Budget/p</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="receipt-outline" size={18} color={Theme.colors.textMuted} />
            <Text style={styles.statValue}>{expenses?.length || 0}</Text>
            <Text style={styles.statLabel}>Expenses</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="location-outline" size={18} color={Theme.colors.textMuted} />
            <Text style={styles.statValue}>{(places || []).length}</Text>
            <Text style={styles.statLabel}>Stops</Text>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'itinerary' && styles.activeTabButton]}
            onPress={() => setActiveTab('itinerary')}
          >
            <Ionicons
              name="map-outline"
              size={16}
              color={activeTab === 'itinerary' ? Theme.colors.accent : Theme.colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === 'itinerary' && styles.activeTabText]}>
              Itinerary ({(places || []).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'overview' && styles.activeTabButton]}
            onPress={() => setActiveTab('overview')}
          >
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={activeTab === 'overview' ? Theme.colors.accent : Theme.colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
              Trip Overview
            </Text>
          </TouchableOpacity>
        </View>

        {/* Itinerary Tab Content */}
        {activeTab === 'itinerary' ? (
          <View style={styles.tabContent}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionHeading}>Daily Schedule</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.addPlaceBtn, { backgroundColor: Theme.colors.surfaceElevated, borderWidth: 1, borderColor: Theme.colors.border }]}
                  onPress={() => router.push({ pathname: '/trip/map', params: { tripId: id } })}
                >
                  <Ionicons name="map-outline" size={15} color={Theme.colors.accent} />
                  <Text style={[styles.addPlaceBtnText, { color: Theme.colors.accent }]}>Map</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addPlaceBtn}
                  onPress={() => setModalVisible(true)}
                >
                  <Ionicons name="add" size={16} color={Theme.colors.accentText} />
                  <Text style={styles.addPlaceBtnText}>Add Stop</Text>
                </TouchableOpacity>
              </View>
            </View>

            {placesError ? (
              <ErrorState title="Failed to load stops" message="Could not fetch itinerary stops." onRetry={refetchPlaces} />
            ) : placesLoading ? (
              <LoadingState message="Loading stops..." />
            ) : dayNumbers.length === 0 ? (
              <EmptyState
                icon="location-outline"
                title="No Stops Added Yet"
                message="Start planning Day 1 by adding attractions, restaurants, or hotels."
                actionLabel="Add First Stop"
                onAction={() => setModalVisible(true)}
              />
            ) : (
              dayNumbers.map((day) => (
                <View key={day} style={styles.dayGroup}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>Day {day}</Text>
                    </View>
                    <Text style={styles.dayCount}>
                      {groupedPlaces[day].length} {groupedPlaces[day].length === 1 ? 'place' : 'places'}
                    </Text>
                  </View>

                  {groupedPlaces[day].map((p) => (
                    <PlaceCard
                      key={p.id}
                      place={p}
                      onDelete={() => handleDeletePlace(p)}
                      onEditNote={() => handleOpenEditNote(p)}
                    />
                  ))}
                </View>
              ))
            )}
          </View>
        ) : (
          /* Overview Tab Content */
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeading}>Trip Details</Text>
            <Card style={styles.overviewCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Destination</Text>
                <Text style={styles.detailValue}>{trip.destination}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{trip.status?.toUpperCase() || 'PLANNING'}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Budget Per Person</Text>
                <Text style={styles.detailValue}>
                  {trip.currency} {trip.budgetPerPerson ? Number(trip.budgetPerPerson).toLocaleString() : 'Not specified'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Logged Expenses</Text>
                <Text style={styles.detailValue}>
                  {trip.currency} {totalExpenseSum.toLocaleString()}
                </Text>
              </View>
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>
                  {calculateTripDays(trip.startDate, trip.endDate)} days
                </Text>
              </View>
            </Card>

            {/* Members Section */}
            <View style={[styles.sectionTitleRow, { marginTop: 24 }]}>
              <Text style={styles.sectionHeading}>
                Trip Members ({totalMemberCount})
              </Text>
              {isOwner ? (
                <TouchableOpacity
                  style={styles.addMemberBtn}
                  onPress={() => setMemberModalVisible(true)}
                >
                  <Ionicons name="person-add" size={14} color={Theme.colors.accent} />
                  <Text style={styles.addMemberBtnText}>Invite</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {membersError ? (
              <ErrorState title="Failed to load members" message="Could not fetch trip members." onRetry={refetchMembers} />
            ) : (
            <Card style={styles.overviewCard}>
              {/* Trip Owner */}
              <View style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {(trip.owner?.name || 'O').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{trip.owner?.name || 'Trip Owner'}</Text>
                  <Text style={styles.memberEmail}>{trip.owner?.email || ''}</Text>
                </View>
                <View style={styles.ownerBadge}>
                  <Text style={styles.ownerBadgeText}>Owner</Text>
                </View>
              </View>

              {/* Members */}
              {activeMembers.map((m: any) => {
                const memberUser = m.user || m;
                const memberUserId = memberUser.id || m.userId;
                return (
                  <View key={m.id || memberUserId} style={styles.memberRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: Theme.colors.surfaceElevated, borderWidth: 1, borderColor: Theme.colors.border }]}>
                      <Text style={[styles.memberAvatarText, { color: Theme.colors.textPrimary }]}>
                        {(memberUser.name || memberUser.email || 'M').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{memberUser.name || 'Co-traveler'}</Text>
                      <Text style={styles.memberEmail}>{memberUser.email || ''}</Text>
                    </View>
                    {isOwner ? (
                      <TouchableOpacity
                        onPress={() => handleRemoveMember(memberUserId, memberUser.name || memberUser.email)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="person-remove-outline" size={18} color={Theme.colors.status.error} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </Card>
            )}

            {/* Leave Trip Option (for non-owners) */}
            {!isOwner && (
              <View style={{ marginTop: 24 }}>
                <Button
                  title="Leave Trip"
                  variant="outline"
                  onPress={handleLeaveTrip}
                  isLoading={leaveTripMutation.isPending}
                  icon={<Ionicons name="exit-outline" size={18} color={Theme.colors.status.error} />}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Place Modal */}
      <BottomSheetModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Add Itinerary Stop"
      >
        <Input
          label="Place / Activity Name"
          placeholder="e.g. Eiffel Tower"
          value={placeName}
          onChangeText={setPlaceName}
        />

        <Input
          label="Address / Area"
          placeholder="e.g. Champ de Mars, Paris"
          value={placeAddress}
          onChangeText={setPlaceAddress}
        />

        <View style={styles.formRow}>
          <Input
            label="Day Number"
            placeholder="1"
            value={placeDay}
            onChangeText={setPlaceDay}
            keyboardType="numeric"
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <Input
            label="Duration (mins)"
            placeholder="60"
            value={placeDuration}
            onChangeText={setPlaceDuration}
            keyboardType="numeric"
            containerStyle={{ flex: 1, marginLeft: 8 }}
          />
        </View>

        <Input
          label="Category"
          placeholder="attraction, restaurant, hotel..."
          value={placeCategory}
          onChangeText={setPlaceCategory}
        />

        <Input
          label="Notes / Tips"
          placeholder="e.g. Pre-booked tickets required"
          value={placeNote}
          onChangeText={setPlaceNote}
          multiline
          numberOfLines={3}
        />

        <View style={styles.modalActions}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => setModalVisible(false)}
            style={{ flex: 1, marginRight: 8 }}
          />
          <Button
            title="Save Stop"
            onPress={handleAddPlace}
            isLoading={addPlaceMutation.isPending}
            style={{ flex: 1, marginLeft: 8 }}
          />
        </View>
      </BottomSheetModal>

      {/* Edit Place Note Modal */}
      <BottomSheetModal
        visible={Boolean(editingPlace)}
        onClose={() => setEditingPlace(null)}
        title="Edit Stop Note"
        subtitle={editingPlace?.name}
      >
        <Input
          label="Stop Note / Instructions"
          placeholder="Add details, opening hours, confirmation code..."
          value={editingNoteText}
          onChangeText={setEditingNoteText}
          multiline
          numberOfLines={4}
        />

        <View style={styles.modalActions}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => setEditingPlace(null)}
            style={{ flex: 1, marginRight: 8 }}
          />
          <Button
            title="Update Note"
            onPress={handleSaveNote}
            isLoading={updateNoteMutation.isPending}
            style={{ flex: 1, marginLeft: 8 }}
          />
        </View>
      </BottomSheetModal>

      {/* Add Member Modal */}
      <BottomSheetModal
        visible={memberModalVisible}
        onClose={() => setMemberModalVisible(false)}
        title="Invite Co-Traveler"
        subtitle="Enter the registered email of the user you want to collaborate with on this trip."
      >
        <Input
          label="User Email Address"
          placeholder="e.g. friend@example.com"
          value={memberEmail}
          onChangeText={setMemberEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          leftIcon={<Ionicons name="mail-outline" size={18} color={Theme.colors.textMuted} />}
        />

        <View style={styles.modalActions}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => setMemberModalVisible(false)}
            style={{ flex: 1, marginRight: 8 }}
          />
          <Button
            title="Send Invite"
            onPress={handleAddMember}
            isLoading={addMemberMutation.isPending}
            style={{ flex: 1, marginLeft: 8 }}
          />
        </View>
      </BottomSheetModal>

      {/* AI Suggestions Modal */}
      <BottomSheetModal
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
        title="AI Itinerary Suggestions"
        subtitle={`Tailored recommendations for ${trip.destination}`}
      >
        {loadingAi ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Theme.colors.accent} />
            <Text style={{ color: Theme.colors.textSecondary, marginTop: 14, fontSize: 13 }}>
              Synthesizing curated activities...
            </Text>
          </View>
        ) : aiSuggestions.length === 0 ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <Ionicons name="bulb-outline" size={36} color={Theme.colors.textMuted} />
            <Text style={{ color: Theme.colors.textPrimary, fontWeight: '600', marginTop: 10 }}>
              No recommendations yet
            </Text>
            <Button
              title="Generate Suggestions"
              onPress={() => handleLoadAiSuggestions(true)}
              style={{ marginTop: 14 }}
            />
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {aiSuggestions.map((sug, idx) => (
              <View key={idx} style={styles.aiSuggestionCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiSugTitle}>{sug.title || sug.name}</Text>
                  {sug.description ? (
                    <Text style={styles.aiSugDesc}>{sug.description}</Text>
                  ) : null}
                  <View style={styles.aiSugMetaRow}>
                    <Text style={styles.aiSugTag}>{sug.category || 'Spot'}</Text>
                    {sug.duration ? (
                      <Text style={styles.aiSugTime}>~{sug.duration} mins</Text>
                    ) : null}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.aiAddBtn}
                  onPress={() => handleAddAiSuggestionToTrip(sug)}
                >
                  <Ionicons name="add" size={16} color={Theme.colors.accentText} />
                  <Text style={styles.aiAddBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <Button
          title="Close"
          variant="outline"
          onPress={() => setAiModalVisible(false)}
          style={{ marginTop: 16 }}
        />
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  heroContainer: {
    position: 'relative',
    height: 220,
    width: '100%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    backgroundColor: Theme.colors.surfaceElevated,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 18, 16, 0.65)',
  },
  headerFloatingActions: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
  },
  floatingActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  tripName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(20, 21, 18, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroMetaText: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  quickActionsBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  quickActionSub: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surface,
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Theme.borderRadius.sm,
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: Theme.colors.surfaceElevated,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.textMuted,
  },
  activeTabText: {
    color: Theme.colors.textPrimary,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  addPlaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.md,
  },
  addPlaceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.accentText,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(167, 169, 154, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167, 169, 154, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.md,
  },
  addMemberBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.accent,
  },
  dayGroup: {
    marginBottom: 20,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayBadge: {
    backgroundColor: Theme.colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  dayCount: {
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  overviewCard: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  detailLabel: {
    fontSize: 13,
    color: Theme.colors.textMuted,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(134, 169, 139, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(134, 169, 139, 0.3)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.status.success,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    gap: 12,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.accentText,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
  },
  memberEmail: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  ownerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(167, 169, 154, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167, 169, 154, 0.3)',
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Theme.colors.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  formRow: {
    flexDirection: 'row',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 16,
  },
  aiSuggestionCard: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiSugTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 2,
  },
  aiSugDesc: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 6,
  },
  aiSugMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiSugTag: {
    fontSize: 10,
    backgroundColor: 'rgba(167, 169, 154, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: Theme.colors.accent,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  aiSugTime: {
    fontSize: 10,
    color: Theme.colors.textMuted,
  },
  aiAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.sm,
  },
  aiAddBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.accentText,
  },
});
