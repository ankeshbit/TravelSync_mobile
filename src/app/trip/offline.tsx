import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { getOfflineTripPack, syncOfflineChanges } from '@/api/trips';
import {
  offlineStorage,
  OfflineTripBundle,
  OfflineTripSummary,
  PendingSyncItem,
} from '@/services/offlineStorage';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { Theme } from '@/constants/theme';

export default function OfflineTripScreen() {
  const { tripId: paramTripId, id } = useLocalSearchParams<{ tripId?: string; id?: string }>();
  const tripId = tripId_or_id(paramTripId, id);
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tripBundle, setTripBundle] = useState<OfflineTripBundle | null>(null);
  const [savedTrips, setSavedTrips] = useState<OfflineTripSummary[]>([]);
  const [pendingQueue, setPendingQueue] = useState<PendingSyncItem[]>([]);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'stays' | 'emergency'>('itinerary');

  // Edit Note Modal
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [noteText, setNoteText] = useState('');

  function tripId_or_id(a?: string, b?: string): string {
    return a || b || '';
  }

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function fetchOfflineData() {
      if (!user?.id) {
        if (isMounted) setLoading(false);
        return;
      }
      try {
        if (tripId) {
          const bundle = await offlineStorage.getOfflineTripBundle(user.id, tripId);
          if (isMounted) setTripBundle(bundle);
          const queue = await offlineStorage.getPendingSyncQueue(user.id, tripId);
          if (isMounted) setPendingQueue(queue);
        }
        const trips = await offlineStorage.getOfflineTrips(user.id);
        if (isMounted) setSavedTrips(trips);
      } catch (err) {
        console.error('Failed to load offline data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchOfflineData();
    return () => {
      isMounted = false;
    };
  }, [user?.id, tripId, refreshKey]);

  const handleDownloadTrip = async () => {
    if (!user?.id || !tripId) return;
    setDownloading(true);
    try {
      const pack = await getOfflineTripPack(tripId);
      await offlineStorage.saveOfflineTripPack(user.id, pack);
      setRefreshKey((k) => k + 1);
      Alert.alert('Downloaded', 'Trip pack saved locally! You can now access full details offline.');
    } catch (err: any) {
      Alert.alert('Download Failed', err?.response?.data?.message || 'Could not fetch offline pack. Check your connection.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSyncPending = async () => {
    if (!user?.id || !tripId || pendingQueue.length === 0) return;
    setSyncing(true);
    try {
      await syncOfflineChanges(tripId, pendingQueue);
      await offlineStorage.clearPendingSyncQueue(user.id, tripId);
      setPendingQueue([]);
      Alert.alert('Synchronized', 'All pending offline changes have been saved to the server!');
    } catch (err: any) {
      Alert.alert('Sync Error', err?.response?.data?.message || 'Failed to sync changes with server.');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenNoteModal = (place: any) => {
    setSelectedPlace(place);
    setNoteText(place.note || '');
    setNoteModalVisible(true);
  };

  const handleSaveNote = async () => {
    if (!user?.id || !tripId || !selectedPlace) return;
    try {
      await offlineStorage.updatePlaceNoteLocal(user.id, tripId, selectedPlace.id, noteText.trim());
      setNoteModalVisible(false);
      setRefreshKey((k) => k + 1);
      Alert.alert('Saved Offline', 'Note updated locally and queued for sync once back online.');
    } catch {
      Alert.alert('Error', 'Failed to save note locally.');
    }
  };

  const handleDeleteOffline = async (targetTripId: string) => {
    if (!user?.id) return;
    Alert.alert('Remove Offline Data', 'Delete saved offline data for this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await offlineStorage.deleteOfflineTrip(user.id, targetTripId);
          setRefreshKey((k) => k + 1);
        },
      },
    ]);
  };

  if (loading) {
    return <LoadingState message="Loading offline companion..." fullscreen />;
  }

  // View: Specific Trip Offline Companion
  if (tripId && tripBundle) {
    const itinerary = tripBundle.itinerary || [];
    const groupedDays = itinerary.reduce<Record<number, any[]>>((acc, p) => {
      const d = p.dayNumber || 1;
      if (!acc[d]) acc[d] = [];
      acc[d].push(p);
      return acc;
    }, {});
    const dayNums = Object.keys(groupedDays).map(Number).sort((a, b) => a - b);

    return (
      <View style={styles.container}>
        {/* Offline Companion Banner */}
        <View style={styles.companionBanner}>
          <View style={styles.badgeRow}>
            <View style={styles.offlineBadge}>
              <Ionicons name="cloud-offline" size={14} color="#D97706" />
              <Text style={styles.offlineBadgeText}>Offline Companion</Text>
            </View>
            {pendingQueue.length > 0 && (
              <TouchableOpacity
                style={styles.syncBtn}
                onPress={handleSyncPending}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="sync" size={14} color="#FFFFFF" />
                    <Text style={styles.syncBtnText}>Sync ({pendingQueue.length})</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.tripTitle}>{tripBundle.trip.name}</Text>
          <Text style={styles.tripMeta}>
            {tripBundle.trip.destination} · {tripBundle.trip.startDate} - {tripBundle.trip.endDate}
          </Text>
          <Text style={styles.downloadedAt}>
            Downloaded: {new Date(tripBundle.downloadedAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'itinerary' && styles.tabItemActive]}
            onPress={() => setActiveTab('itinerary')}
          >
            <Ionicons
              name="map-outline"
              size={16}
              color={activeTab === 'itinerary' ? Theme.colors.accent : Theme.colors.textMuted}
            />
            <Text style={[styles.tabItemText, activeTab === 'itinerary' && styles.tabItemTextActive]}>
              Itinerary ({itinerary.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'stays' && styles.tabItemActive]}
            onPress={() => setActiveTab('stays')}
          >
            <Ionicons
              name="bed-outline"
              size={16}
              color={activeTab === 'stays' ? Theme.colors.accent : Theme.colors.textMuted}
            />
            <Text style={[styles.tabItemText, activeTab === 'stays' && styles.tabItemTextActive]}>
              Stays & Transport ({tripBundle.staysAndTransport.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'emergency' && styles.tabItemActive]}
            onPress={() => setActiveTab('emergency')}
          >
            <Ionicons
              name="medkit-outline"
              size={16}
              color={activeTab === 'emergency' ? Theme.colors.accent : Theme.colors.textMuted}
            />
            <Text style={[styles.tabItemText, activeTab === 'emergency' && styles.tabItemTextActive]}>
              Emergency
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === 'itinerary' && (
            <View>
              {dayNums.length === 0 ? (
                <EmptyState
                  icon="map-outline"
                  title="No Stops in Itinerary"
                  message="This trip does not have any itinerary stops saved."
                />
              ) : (
                dayNums.map((day) => (
                  <View key={day} style={styles.daySection}>
                    <View style={styles.dayHeader}>
                      <View style={styles.dayBadge}>
                        <Text style={styles.dayBadgeText}>{day}</Text>
                      </View>
                      <Text style={styles.dayHeading}>Day {day}</Text>
                      <Text style={styles.daySub}>· {groupedDays[day].length} stop(s)</Text>
                    </View>

                    {groupedDays[day].map((place, idx) => (
                      <Card key={place.id || idx} style={styles.placeCard}>
                        <View style={styles.placeHeader}>
                          <Text style={styles.placeName}>{place.name}</Text>
                          <View style={styles.categoryPill}>
                            <Text style={styles.categoryPillText}>{place.category || 'Spot'}</Text>
                          </View>
                        </View>
                        <Text style={styles.placeAddress}>{place.address}</Text>

                        {place.note ? (
                          <View style={styles.noteBox}>
                            <Text style={styles.noteLabel}>Note:</Text>
                            <Text style={styles.noteText}>{place.note}</Text>
                          </View>
                        ) : null}

                        <TouchableOpacity
                          style={styles.editNoteBtn}
                          onPress={() => handleOpenNoteModal(place)}
                        >
                          <Ionicons name="create-outline" size={14} color={Theme.colors.accent} />
                          <Text style={styles.editNoteBtnText}>{place.note ? 'Edit Note' : 'Add Note'}</Text>
                        </TouchableOpacity>
                      </Card>
                    ))}
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'stays' && (
            <View>
              {tripBundle.staysAndTransport.length === 0 ? (
                <EmptyState
                  icon="bed-outline"
                  title="No Stays or Transport"
                  message="No hotel bookings or transportation legs recorded in this offline pack."
                />
              ) : (
                tripBundle.staysAndTransport.map((item, idx) => (
                  <Card key={idx} style={styles.stayCard}>
                    <View style={styles.stayHeader}>
                      <View style={styles.stayTypePill}>
                        <Ionicons
                          name={item.type === 'flight' ? 'airplane-outline' : 'bed-outline'}
                          size={14}
                          color={Theme.colors.accent}
                        />
                        <Text style={styles.stayTypePillText}>{item.type || 'Booking'}</Text>
                      </View>
                      {item.bookingRef && (
                        <Text style={styles.bookingRef}>Ref: {item.bookingRef}</Text>
                      )}
                    </View>
                    <Text style={styles.stayName}>{item.name}</Text>
                    <Text style={styles.stayAddress}>{item.address || 'Address provided on arrival'}</Text>
                    {item.notes && <Text style={styles.stayNotes}>{item.notes}</Text>}
                  </Card>
                ))
              )}
            </View>
          )}

          {activeTab === 'emergency' && (
            <View>
              <Card style={styles.emergencyCard}>
                <Ionicons name="warning-outline" size={24} color="#D97706" />
                <Text style={styles.emergencyTitle}>Local Helplines & Emergency</Text>
                <Text style={styles.emergencyDesc}>
                  Emergency numbers and contacts saved for {tripBundle.trip.destination}. Note: Emergency voice calls require active cellular network reception.
                </Text>
                <View style={styles.helplineRow}>
                  <Text style={styles.helplineLabel}>Local Emergency Services</Text>
                  <Text style={styles.helplineValue}>112 / 911</Text>
                </View>
              </Card>
            </View>
          )}
        </ScrollView>

        {/* Edit Note Modal */}
        <Modal visible={noteModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Offline Place Note</Text>
                <TouchableOpacity onPress={() => setNoteModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalPlaceName}>{selectedPlace?.name}</Text>
              <Input
                label="Note"
                placeholder="Enter notes, opening hours, confirmation codes..."
                value={noteText}
                onChangeText={setNoteText}
                multiline
                numberOfLines={4}
              />

              <Button title="Save Offline Note" onPress={handleSaveNote} style={{ marginTop: 12 }} />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // View: Offline Dashboard / Not downloaded yet
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="cloud-offline" size={24} color={Theme.colors.accent} />
            <Text style={styles.headerTitle}>Offline Travel Companion</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Access saved itineraries, booking records, and travel notes without internet connection.
          </Text>
        </View>

        {tripId && !tripBundle && (
          <Card style={styles.downloadPromptCard}>
            <Ionicons name="download-outline" size={32} color={Theme.colors.accent} />
            <Text style={styles.downloadPromptTitle}>Trip Not Yet Saved Offline</Text>
            <Text style={styles.downloadPromptSub}>
              Download the full trip pack to your device to use it anytime in airplane mode.
            </Text>
            <Button
              title="Download Trip Pack"
              onPress={handleDownloadTrip}
              isLoading={downloading}
              style={{ marginTop: 14 }}
            />
          </Card>
        )}

        <View style={styles.savedSection}>
          <Text style={styles.savedHeading}>Saved Offline Trips ({savedTrips.length})</Text>

          {savedTrips.length === 0 ? (
            <EmptyState
              icon="folder-open-outline"
              title="No Saved Trips"
              message="When connected to internet, open a trip and download its offline companion pack."
            />
          ) : (
            savedTrips.map((t) => (
              <Card key={t.tripId} style={styles.savedTripCard}>
                <View style={styles.savedTripMain}>
                  <View style={styles.savedTripIcon}>
                    <Ionicons name="trail-sign-outline" size={20} color={Theme.colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedTripName}>{t.name}</Text>
                    <Text style={styles.savedTripDest}>{t.destination}</Text>
                    <Text style={styles.savedTripDetails}>
                      {t.placesCount} stops · Saved {new Date(t.downloadedAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.savedTripActions}>
                  <TouchableOpacity
                    style={styles.openTripBtn}
                    onPress={() => router.push({ pathname: '/trip/offline', params: { tripId: t.tripId } })}
                  >
                    <Ionicons name="eye-outline" size={16} color={Theme.colors.accentText} />
                    <Text style={styles.openTripBtnText}>Open</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteTripBtn}
                    onPress={() => handleDeleteOffline(t.tripId)}
                  >
                    <Ionicons name="trash-outline" size={16} color={Theme.colors.status.error} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  companionBanner: {
    padding: 20,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  offlineBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.status.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  syncBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tripTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
  },
  tripMeta: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  downloadedAt: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Theme.colors.accent,
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textMuted,
  },
  tabItemTextActive: {
    color: Theme.colors.accent,
  },
  daySection: {
    marginBottom: 20,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  dayBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: Theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Theme.colors.accent,
  },
  dayHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  daySub: {
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  placeCard: {
    padding: 14,
    marginBottom: 10,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    flex: 1,
  },
  categoryPill: {
    backgroundColor: Theme.colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  placeAddress: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginBottom: 8,
  },
  noteBox: {
    backgroundColor: Theme.colors.surfaceElevated,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Theme.colors.textMuted,
    marginBottom: 2,
  },
  noteText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  editNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  editNoteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.accent,
  },
  stayCard: {
    padding: 14,
    marginBottom: 10,
  },
  stayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stayTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stayTypePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.accent,
    textTransform: 'uppercase',
  },
  bookingRef: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    fontFamily: 'monospace',
  },
  stayName: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  stayAddress: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  stayNotes: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  emergencyCard: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  emergencyDesc: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  helplineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  helplineLabel: {
    fontSize: 13,
    color: Theme.colors.textPrimary,
    fontWeight: '600',
  },
  helplineValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Theme.colors.status.error,
  },
  header: {
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
  },
  downloadPromptCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  downloadPromptTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginTop: 10,
  },
  downloadPromptSub: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  savedSection: {
    marginTop: 8,
  },
  savedHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 12,
  },
  savedTripCard: {
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedTripMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  savedTripIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedTripName: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  savedTripDest: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 1,
  },
  savedTripDetails: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  savedTripActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },
  openTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  openTripBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.accentText,
  },
  deleteTripBtn: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  modalPlaceName: {
    fontSize: 13,
    color: Theme.colors.accent,
    fontWeight: '600',
    marginBottom: 12,
  },
});
