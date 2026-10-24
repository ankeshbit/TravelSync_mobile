import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useTrip,
  useTripPlaces,
  useAddTripPlace,
  useDeleteTripPlace,
  useUpdatePlaceNote,
  useReorderTripPlaces,
  useAiTripSuggestions,
} from '@/hooks/useTripDetails';
import { useTripSocket } from '@/hooks/useTripSocket';
import { TripPresence } from '@/components/trips/TripPresence';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { BrandLogo } from '@/components/common/BrandLogo';
import { Theme } from '@/constants/theme';
import { geocodePlace } from '@/utils/geocoding';
import { calculateTripDays, parseCalendarDate } from '@/utils/dateUtils';
import { Place, AiSuggestion } from '@/types/trip';


import { TripMapView } from '@/components/trips/TripMapView';

const CATEGORIES = [
  { id: 'attraction', label: 'Attraction', icon: 'map-outline' },
  { id: 'food', label: 'Restaurant / Cafe', icon: 'restaurant-outline' },
  { id: 'hotel', label: 'Hotel / Stay', icon: 'bed-outline' },
  { id: 'activity', label: 'Activity', icon: 'bicycle-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

export default function TripMapScreen() {
  const { id, tripId: paramTripId } = useLocalSearchParams<{ id?: string; tripId?: string }>();
  const tripId = id || paramTripId || '';

  const { data: trip, isLoading: tripLoading } = useTrip(tripId);
  const {
    data: places = [],
    isLoading: placesLoading,
    refetch: refetchPlaces,
    isRefetching,
  } = useTripPlaces(tripId);

  // Real-time Socket.IO collaboration
  const { activeMembers } = useTripSocket(tripId);

  const addPlaceMutation = useAddTripPlace(tripId);
  const deletePlaceMutation = useDeleteTripPlace(tripId);
  const updateNoteMutation = useUpdatePlaceNote(tripId);
  const reorderPlacesMutation = useReorderTripPlaces(tripId);
  const aiSuggestionsMutation = useAiTripSuggestions(tripId);

  const [activeDay, setActiveDay] = useState<number>(1);
  const [extraDaysCount, setExtraDaysCount] = useState<number>(0);

  // Add Place Modal
  const [addPlaceModalVisible, setAddPlaceModalVisible] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeCategory, setPlaceCategory] = useState('attraction');
  const [placeNote, setPlaceNote] = useState('');

  // Edit Note Modal
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [editNoteText, setEditNoteText] = useState('');

  // AI Planner Modal
  const [aiPlannerVisible, setAiPlannerVisible] = useState(false);
  const [aiBudget, setAiBudget] = useState('moderate');
  const [aiInterests, setAiInterests] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);

  // Calculate days list using safe calendar date math
  const computedDays = useMemo(() => {
    const baseCount = calculateTripDays(trip?.startDate, trip?.endDate);
    const maxDayFromPlaces = places.reduce((max, p) => Math.max(max, p.dayNumber || 1), 1);
    const totalDays = Math.max(baseCount + extraDaysCount, maxDayFromPlaces);

    return Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      let dateLabel = `Day ${dayNum}`;
      const startDate = parseCalendarDate(trip?.startDate);
      if (startDate) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
        dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
      return { num: dayNum, date: dateLabel };
    });
  }, [trip, extraDaysCount, places]);

  // Current day places sorted by orderIndex
  const currentDayPlaces = useMemo(() => {
    return places
      .filter((p) => (p.dayNumber || 1) === activeDay)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }, [places, activeDay]);

  // Places with valid coordinates for the current active day
  const placesWithCoords = useMemo(() => {
    return currentDayPlaces.filter(
      (p) => typeof p.lat === 'number' && typeof p.lng === 'number' && (p.lat !== 0 || p.lng !== 0)
    );
  }, [currentDayPlaces]);

  const handleAddDay = () => {
    setExtraDaysCount((prev) => prev + 1);
    setActiveDay(computedDays.length + 1);
  };

  const handleOpenAddPlace = () => {
    setPlaceName('');
    setPlaceAddress(trip?.destination || '');
    setPlaceCategory('attraction');
    setPlaceNote('');
    setAddPlaceModalVisible(true);
  };

  const handleSavePlace = async () => {
    if (!placeName.trim()) {
      Alert.alert('Required', 'Please enter a name for this place.');
      return;
    }

    try {
      const nextOrder = currentDayPlaces.length > 0
        ? Math.max(...currentDayPlaces.map((p) => p.orderIndex ?? 0)) + 1
        : 0;

      const coords = await geocodePlace(placeAddress.trim() || placeName.trim(), trip?.destination);

      await addPlaceMutation.mutateAsync({
        name: placeName.trim(),
        address: placeAddress.trim() || placeName.trim(),
        ...(coords.lat !== undefined && coords.lng !== undefined ? { lat: coords.lat, lng: coords.lng } : {}),
        dayNumber: activeDay,
        category: placeCategory,
        orderIndex: nextOrder,
        note: placeNote.trim(),
      });

      setAddPlaceModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to add place.');
    }
  };

  const handleDeletePlace = (place: Place) => {
    Alert.alert('Delete Place', `Remove "${place.name}" from Day ${activeDay}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deletePlaceMutation.mutate(place.id),
      },
    ]);
  };

  const handleOpenEditNote = (place: Place) => {
    setEditingPlace(place);
    setEditNoteText(place.note || '');
  };

  const handleSaveNote = async () => {
    if (!editingPlace) return;
    try {
      await updateNoteMutation.mutateAsync({
        placeId: editingPlace.id,
        note: editNoteText.trim(),
      });
      setEditingPlace(null);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update note.');
    }
  };

  const handleMovePlace = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentDayPlaces.length) return;

    const reordered = [...currentDayPlaces];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const updates = reordered.map((p, idx) => ({
      placeId: p.id,
      dayNumber: activeDay,
      orderIndex: idx,
    }));

    try {
      await reorderPlacesMutation.mutateAsync(updates);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to reorder places.');
    }
  };

  // AI Suggestions Generator
  const handleGenerateAiPlan = async () => {
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const res = await aiSuggestionsMutation.mutateAsync({
        budget: aiBudget,
        interests: aiInterests.trim(),
      });
      const list = Array.isArray(res) ? res : (res as any)?.suggestions || [];
      setAiSuggestions(list);
    } catch (err: any) {
      Alert.alert('AI Guide Error', err?.response?.data?.message || 'Failed to generate itinerary suggestions.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddAiPlaceToDay = async (sug: AiSuggestion) => {
    try {
      const nextOrder = currentDayPlaces.length > 0
        ? Math.max(...currentDayPlaces.map((p) => p.orderIndex ?? 0)) + 1
        : 0;

      const coords = await geocodePlace(sug.location || sug.title || sug.name || '', trip?.destination);

      await addPlaceMutation.mutateAsync({
        name: sug.title || sug.name || 'AI Activity',
        address: sug.location || trip?.destination || 'Destination Area',
        ...(coords.lat !== undefined && coords.lng !== undefined ? { lat: coords.lat, lng: coords.lng } : {}),
        dayNumber: activeDay,
        category: sug.category || 'attraction',
        orderIndex: nextOrder,
        note: sug.description || '',
      });

      Alert.alert('Added', `"${sug.title || sug.name}" added to Day ${activeDay}!`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to add place.');
    }
  };

  if (tripLoading || placesLoading) {
    return <LoadingState message="Loading itinerary and map..." fullscreen />;
  }

  if (!trip) {
    return <ErrorState title="Trip Not Found" message="Could not load itinerary for this trip." onRetry={refetchPlaces} fullscreen />;
  }

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle} numberOfLines={1}>{trip.name}</Text>
          <Text style={styles.screenSubtitle}>Day-by-Day Itinerary & Map</Text>
        </View>

        <View style={styles.headerActions}>
          <TripPresence activeMembers={activeMembers} />

          <TouchableOpacity
            style={styles.aiButton}
            onPress={() => setAiPlannerVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={15} color={Theme.colors.accentText} />
            <Text style={styles.aiButtonText}>AI Plan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addPlaceTopBtn}
            onPress={handleOpenAddPlace}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color={Theme.colors.accentText} />
            <Text style={styles.addPlaceTopText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Day Tabs Horizontal Bar */}
      <View style={styles.dayTabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabsContainer}>
          {computedDays.map((day) => {
            const isSelected = activeDay === day.num;
            return (
              <TouchableOpacity
                key={day.num}
                style={[styles.dayTabPill, isSelected && styles.dayTabPillActive]}
                onPress={() => setActiveDay(day.num)}
              >
                <Text style={[styles.dayTabTitle, isSelected && styles.dayTabTitleActive]}>
                  Day {day.num}
                </Text>
                <Text style={[styles.dayTabDate, isSelected && styles.dayTabDateActive]}>
                  {day.date}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.addDayButton} onPress={handleAddDay}>
            <Ionicons name="add" size={16} color={Theme.colors.accent} />
            <Text style={styles.addDayText}>Add Day</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetchPlaces();
            }}
            colors={[Theme.colors.accent]}
            tintColor={Theme.colors.accent}
          />
        }
      >
        {/* Real Map / Interactive Map Banner */}
        <View style={styles.mapCanvasCard}>
          <TripMapView
            destination={trip.destination}
            activeDay={activeDay}
            places={currentDayPlaces}
            placesWithCoords={placesWithCoords}
          />
        </View>

        {/* Places Timeline List for Day */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineHeader}>
            <Text style={styles.timelineHeading}>Day {activeDay} Itinerary</Text>
            <TouchableOpacity onPress={handleOpenAddPlace} style={styles.inlineAddBtn}>
              <Ionicons name="add" size={14} color={Theme.colors.accent} />
              <Text style={styles.inlineAddBtnText}>Add Place</Text>
            </TouchableOpacity>
          </View>

          {currentDayPlaces.length === 0 ? (
            <View style={styles.emptyDayBox}>
              <Ionicons name="calendar-outline" size={36} color={Theme.colors.textMuted} />
              <Text style={styles.emptyDayTitle}>No stops added for Day {activeDay}</Text>
              <Text style={styles.emptyDayDesc}>
                Plan activities, restaurants, or sight-seeing spots for this day.
              </Text>
              <Button
                title="Add Stop to Day"
                onPress={handleOpenAddPlace}
                style={{ marginTop: 14 }}
                icon={<Ionicons name="add" size={16} color={Theme.colors.accentText} />}
              />
            </View>
          ) : (
            currentDayPlaces.map((place, idx) => {
              const catConfig = CATEGORIES.find((c) => c.id === place.category) || CATEGORIES[0];
              const isFirst = idx === 0;
              const isLast = idx === currentDayPlaces.length - 1;

              return (
                <View key={place.id} style={styles.placeCard}>
                  <View style={styles.placeIconBox}>
                    <Ionicons name={catConfig.icon as any} size={18} color={Theme.colors.accent} />
                    <Text style={styles.placeOrderIndex}>#{idx + 1}</Text>
                  </View>

                  <View style={styles.placeDetails}>
                    <View style={styles.placeTitleRow}>
                      <Text style={styles.placeName}>{place.name}</Text>
                      <View style={styles.categoryPill}>
                        <Text style={styles.categoryPillText}>{catConfig.label}</Text>
                      </View>
                    </View>

                    <Text style={styles.placeAddress}>
                      <Ionicons name="location-outline" size={12} color={Theme.colors.textMuted} /> {place.address}
                      {typeof place.lat === 'number' && typeof place.lng === 'number' && (place.lat !== 0 || place.lng !== 0)
                        ? ` • ${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`
                        : ' • Location not set'}
                    </Text>

                    {place.note ? (
                      <View style={styles.noteBox}>
                        <Ionicons name="document-text-outline" size={12} color={Theme.colors.accent} />
                        <Text style={styles.noteText}>{place.note}</Text>
                      </View>
                    ) : null}

                    {/* Actions Row */}
                    <View style={styles.placeActionsRow}>
                      <TouchableOpacity
                        style={styles.actionPill}
                        onPress={() => handleOpenEditNote(place)}
                      >
                        <Ionicons name="pencil-outline" size={12} color={Theme.colors.textSecondary} />
                        <Text style={styles.actionPillText}>{place.note ? 'Edit Note' : 'Add Note'}</Text>
                      </TouchableOpacity>

                      <View style={styles.reorderControls}>
                        <TouchableOpacity
                          style={[styles.orderArrowBtn, isFirst && styles.orderArrowDisabled]}
                          onPress={() => handleMovePlace(idx, 'up')}
                          disabled={isFirst}
                        >
                          <Ionicons name="chevron-up" size={14} color={isFirst ? Theme.colors.border : Theme.colors.textPrimary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.orderArrowBtn, isLast && styles.orderArrowDisabled]}
                          onPress={() => handleMovePlace(idx, 'down')}
                          disabled={isLast}
                        >
                          <Ionicons name="chevron-down" size={14} color={isLast ? Theme.colors.border : Theme.colors.textPrimary} />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.deletePill}
                        onPress={() => handleDeletePlace(place)}
                      >
                        <Ionicons name="trash-outline" size={14} color={Theme.colors.status.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Add Place Modal */}
      <Modal visible={addPlaceModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Stop to Day {activeDay}</Text>
              <TouchableOpacity onPress={() => setAddPlaceModalVisible(false)}>
                <Ionicons name="close" size={22} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Input
                label="Place / Activity Name"
                placeholder="e.g. Louvre Museum"
                value={placeName}
                onChangeText={setPlaceName}
              />

              <Input
                label="Address / Area"
                placeholder="e.g. Rue de Rivoli, Paris"
                value={placeAddress}
                onChangeText={setPlaceAddress}
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.categoryPickerRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChoice,
                      placeCategory === cat.id && styles.categoryChoiceActive,
                    ]}
                    onPress={() => setPlaceCategory(cat.id)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={14}
                      color={placeCategory === cat.id ? Theme.colors.accentText : Theme.colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.categoryChoiceText,
                        placeCategory === cat.id && styles.categoryChoiceTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="Notes / Tips (Optional)"
                placeholder="Opening times, booking IDs, tips..."
                value={placeNote}
                onChangeText={setPlaceNote}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setAddPlaceModalVisible(false)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Save Place"
                  onPress={handleSavePlace}
                  isLoading={addPlaceMutation.isPending}
                  style={{ flex: 1, marginLeft: 8 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Note Modal */}
      <Modal visible={Boolean(editingPlace)} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Stop Note</Text>
              <TouchableOpacity onPress={() => setEditingPlace(null)}>
                <Ionicons name="close" size={22} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: Theme.colors.accent, fontSize: 13, marginBottom: 14 }}>
              {editingPlace?.name}
            </Text>

            <Input
              label="Stop Notes & Instructions"
              placeholder="Add details, confirmations..."
              value={editNoteText}
              onChangeText={setEditNoteText}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalButtons}>
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
          </View>
        </View>
      </Modal>

      {/* AI Planner Modal matching AiPlannerModal.vue */}
      <Modal visible={aiPlannerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={20} color={Theme.colors.accent} />
                <Text style={styles.modalTitle}>AI Itinerary Planner</Text>
              </View>
              <TouchableOpacity onPress={() => setAiPlannerVisible(false)}>
                <Ionicons name="close" size={22} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 12, color: Theme.colors.textMuted }}>
                Generate structured stops for {trip.destination} powered by
              </Text>
              <BrandLogo size="xs" title="TravelSync AI" />
            </View>

            <View style={styles.aiFilterRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Budget Focus"
                  placeholder="e.g. moderate, luxury, budget"
                  value={aiBudget}
                  onChangeText={setAiBudget}
                />
              </View>
              <View style={{ flex: 1.5, marginLeft: 8 }}>
                <Input
                  label="Interests"
                  placeholder="e.g. art, museums, food"
                  value={aiInterests}
                  onChangeText={setAiInterests}
                />
              </View>
            </View>

            <Button
              title={aiLoading ? 'Generating Plan...' : 'Generate AI Suggestions'}
              onPress={handleGenerateAiPlan}
              isLoading={aiLoading}
              icon={<Ionicons name="sparkles-outline" size={16} color={Theme.colors.accentText} />}
            />

            <ScrollView style={{ marginTop: 14, maxHeight: 300 }}>
              {aiLoading ? (
                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={Theme.colors.accent} />
                  <Text style={{ color: Theme.colors.textMuted, fontSize: 12, marginTop: 10 }}>
                    Crafting personalized itinerary stops...
                  </Text>
                </View>
              ) : aiSuggestions.length === 0 ? (
                <Text style={{ textAlign: 'center', color: Theme.colors.textMuted, fontSize: 12, paddingVertical: 20 }}>
                  Tap &quot;Generate AI Suggestions&quot; to review curated places for your trip.
                </Text>
              ) : (
                aiSuggestions.map((sug, idx) => (
                  <View key={idx} style={styles.aiSugItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aiSugTitle}>{sug.title || sug.name}</Text>
                      {sug.description ? (
                        <Text style={styles.aiSugDesc}>{sug.description}</Text>
                      ) : null}
                      <Text style={styles.aiSugTag}>{sug.category || 'Spot'}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.addSugBtn}
                      onPress={() => handleAddAiPlaceToDay(sug)}
                    >
                      <Ionicons name="add" size={14} color={Theme.colors.accentText} />
                      <Text style={styles.addSugBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
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
    backgroundColor: Theme.colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: Theme.colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.accent,
  },
  screenTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
  },
  screenSubtitle: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#91B49A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.md,
  },
  aiButtonText: {
    color: '#151915',
    fontSize: 11,
    fontWeight: '700',
  },
  addPlaceTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.md,
  },
  addPlaceTopText: {
    color: Theme.colors.accentText,
    fontSize: 11,
    fontWeight: '700',
  },
  dayTabsWrapper: {
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    paddingVertical: 8,
  },
  dayTabsContainer: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  dayTabPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    minWidth: 78,
  },
  dayTabPillActive: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  dayTabTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
  },
  dayTabTitleActive: {
    color: Theme.colors.accentText,
  },
  dayTabDate: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  dayTabDateActive: {
    color: Theme.colors.accentText,
    opacity: 0.9,
  },
  addDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(167, 169, 154, 0.08)',
  },
  addDayText: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.accent,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

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
  mapCanvasCard: {
    backgroundColor: '#141512',
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    minHeight: 160,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    marginBottom: 20,
  },
  mapGridPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mapEmptyState: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  mapEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginTop: 8,
  },
  mapEmptySubtitle: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  mapMarkersContainer: {
    gap: 8,
  },
  mapHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(27, 28, 25, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 6,
  },
  mapHeaderBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
  },
  pinsWrap: {
    gap: 8,
  },
  mapPinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(27, 28, 25, 0.9)',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.md,
    gap: 10,
  },
  pinNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: Theme.colors.accentText,
  },
  pinInfo: {
    flex: 1,
  },
  pinName: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  pinAddress: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  pinCategoryTag: {
    backgroundColor: 'rgba(167, 169, 154, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pinCategoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.accent,
    textTransform: 'uppercase',
  },
  timelineSection: {
    gap: 12,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
  },
  inlineAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineAddBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.accent,
  },
  emptyDayBox: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
  },
  emptyDayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginTop: 10,
  },
  emptyDayDesc: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  placeCard: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 14,
    gap: 12,
  },
  placeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeOrderIndex: {
    fontSize: 9,
    fontWeight: '700',
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  placeDetails: {
    flex: 1,
  },
  placeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  categoryPill: {
    backgroundColor: 'rgba(167, 169, 154, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.accent,
  },
  placeAddress: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginBottom: 6,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
  },
  noteText: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    flex: 1,
  },
  placeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionPillText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: '500',
  },
  reorderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderArrowBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: Theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  orderArrowDisabled: {
    opacity: 0.3,
  },
  deletePill: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
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
    color: Theme.colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textMuted,
    marginBottom: 8,
  },
  categoryPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  categoryChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  categoryChoiceActive: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  categoryChoiceText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  categoryChoiceTextActive: {
    color: Theme.colors.accentText,
    fontWeight: '700',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 18,
  },
  aiFilterRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  aiSugItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 8,
    gap: 10,
  },
  aiSugTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  aiSugDesc: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  aiSugTag: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.accent,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  addSugBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addSugBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.accentText,
  },
});
