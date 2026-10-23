import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTrip, useTripPlaces, useAddTripPlace, useDeleteTripPlace, useTripExpenses } from '@/hooks/useTripDetails';
import { PlaceCard } from '@/components/trips/PlaceCard';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Place, Expense } from '@/types/trip';

export default function TripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [activeTab, setActiveTab] = useState<'itinerary' | 'overview'>('itinerary');
  const [modalVisible, setModalVisible] = useState(false);

  // New Place Form state
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeDay, setPlaceDay] = useState('1');
  const [placeCategory, setPlaceCategory] = useState('attraction');
  const [placeDuration, setPlaceDuration] = useState('60');
  const [placeNote, setPlaceNote] = useState('');

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
    refetch: refetchPlaces,
  } = useTripPlaces(id || '');

  const {
    data: expenses,
    refetch: refetchExpenses,
  } = useTripExpenses(id || '');

  const addPlaceMutation = useAddTripPlace(id || '');
  const deletePlaceMutation = useDeleteTripPlace(id || '');

  const onRefresh = async () => {
    await Promise.all([refetchTrip(), refetchPlaces(), refetchExpenses()]);
  };

  const handleAddPlace = async () => {
    if (!placeName.trim()) {
      Alert.alert('Required', 'Please enter a name for this place or activity.');
      return;
    }

    try {
      await addPlaceMutation.mutateAsync({
        name: placeName.trim(),
        address: placeAddress.trim() || 'General location',
        lat: 0.0,
        lng: 0.0,
        dayNumber: parseInt(placeDay, 10) || 1,
        category: placeCategory,
        duration: parseInt(placeDuration, 10) || 60,
        note: placeNote.trim(),
      });

      setModalVisible(false);
      setPlaceName('');
      setPlaceAddress('');
      setPlaceNote('');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to add place to itinerary.');
    }
  };

  const handleDeletePlace = (place: Place) => {
    Alert.alert('Delete Place', `Remove "${place.name}" from the itinerary?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deletePlaceMutation.mutate(place.id),
      },
    ]);
  };

  if (tripLoading) {
    return <LoadingState message="Loading trip itinerary..." fullscreen />;
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

  const totalExpenseSum = (expenses || []).reduce((acc: number, curr: Expense) => acc + (Number(curr.amount) || 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} colors={['#2563EB']} />
        }
      >
        {/* Cover Photo / Header Banner */}
        {trip.coverImageUrl ? (
          <Image source={{ uri: trip.coverImageUrl }} style={styles.heroImage} contentFit="cover" />
        ) : null}

        <View style={styles.headerInfo}>
          <Text style={styles.destination}>{trip.destination}</Text>
          <Text style={styles.tripName}>{trip.name}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#64748B" />
              <Text style={styles.metaText}>
                {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{trip.status.toUpperCase()}</Text>
            </View>
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
              color={activeTab === 'itinerary' ? '#2563EB' : '#64748B'}
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
              color={activeTab === 'overview' ? '#2563EB' : '#64748B'}
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
              <TouchableOpacity
                style={styles.addPlaceBtn}
                onPress={() => setModalVisible(true)}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.addPlaceBtnText}>Add Stop</Text>
              </TouchableOpacity>
            </View>

            {placesLoading ? (
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
                    <PlaceCard key={p.id} place={p} onDelete={() => handleDeletePlace(p)} />
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
                <Text style={styles.detailLabel}>Budget Per Person</Text>
                <Text style={styles.detailValue}>
                  {trip.currency} {trip.budgetPerPerson || 'Not specified'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Logged Expenses</Text>
                <Text style={styles.detailValue}>
                  {trip.currency} {totalExpenseSum.toLocaleString()}
                </Text>
              </View>
            </Card>

            <Text style={[styles.sectionHeading, { marginTop: 20 }]}>
              Trip Members ({1 + (trip.members?.length || 0)})
            </Text>
            <Card style={styles.overviewCard}>
              {/* Owner */}
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
              {(trip.members || []).map((m) => (
                <View key={m.id} style={styles.memberRow}>
                  <View style={[styles.memberAvatar, { backgroundColor: '#7C3AED' }]}>
                    <Text style={styles.memberAvatarText}>
                      {(m.user?.name || 'M').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.user?.name || 'Co-traveler'}</Text>
                    <Text style={styles.memberEmail}>{m.user?.email || ''}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Add Place Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Itinerary Stop</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView>
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
                placeholder="attraction, food, hotel, nature"
                value={placeCategory}
                onChangeText={setPlaceCategory}
              />

              <Input
                label="Notes / Tips (optional)"
                placeholder="e.g. Book tickets online in advance"
                value={placeNote}
                onChangeText={setPlaceNote}
                multiline
              />

              <Button
                title="Add to Itinerary"
                onPress={handleAddPlace}
                isLoading={addPlaceMutation.isPending}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    paddingBottom: 40,
  },
  heroImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#E2E8F0',
  },
  headerInfo: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  destination: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tripName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  activeTabButton: {
    borderBottomColor: '#2563EB',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#2563EB',
  },
  tabContent: {
    padding: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  addPlaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addPlaceBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  dayGroup: {
    marginBottom: 20,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dayBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dayBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dayCount: {
    fontSize: 12,
    color: '#64748B',
  },
  overviewCard: {
    marginTop: 8,
  },
  detailRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  memberAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  memberEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  ownerBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownerBadgeText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  formRow: {
    flexDirection: 'row',
  },
});
