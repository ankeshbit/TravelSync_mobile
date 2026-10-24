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
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
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
import { TRIP_KEYS } from '@/hooks/useTrips';
import { formatDateRange, formatDate } from '@/utils/dateUtils';
import { getErrorMessage } from '@/api/client';

export default function OfflineTripScreen() {
  const { tripId: paramTripId, id } = useLocalSearchParams<{ tripId?: string; id?: string }>();
  const tripId = paramTripId || id || '';
  const queryClient = useQueryClient();
  const { user, firebaseUser } = useAuth();

  // Storage key: always prefer firebaseUser.uid so cold start with no network works
  const storageUserId = firebaseUser?.uid || user?.id || '';

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tripBundle, setTripBundle] = useState<OfflineTripBundle | null>(null);
  const [savedTrips, setSavedTrips] = useState<OfflineTripSummary[]>([]);
  const [pendingQueue, setPendingQueue] = useState<PendingSyncItem[]>([]);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'stays' | 'docs' | 'emergency'>('itinerary');

  // Edit Note Modal
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [noteText, setNoteText] = useState('');

  const [refreshKey, setRefreshKey] = useState(0);

  // One-time legacy migration from user.id to firebaseUser.uid
  useEffect(() => {
    if (user?.id && firebaseUser?.uid && user.id !== firebaseUser.uid) {
      offlineStorage.migrateLegacyUserStorage(user.id, firebaseUser.uid).then(() => {
        setRefreshKey((k) => k + 1);
      });
    }
  }, [user?.id, firebaseUser?.uid]);

  useEffect(() => {
    let isMounted = true;

    async function fetchOfflineData() {
      if (!storageUserId) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        if (tripId) {
          const bundle = await offlineStorage.getOfflineTripBundle(storageUserId, tripId);
          if (isMounted) setTripBundle(bundle);
          const queue = await offlineStorage.getPendingSyncQueue(storageUserId, tripId);
          if (isMounted) setPendingQueue(queue);
        }
        const trips = await offlineStorage.getOfflineTrips(storageUserId);
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
  }, [storageUserId, tripId, refreshKey]);

  const handleDownloadTrip = async (isRefresh = false) => {
    if (!storageUserId || !tripId) return;
    setDownloading(true);
    try {
      const pack = await getOfflineTripPack(tripId);
      await offlineStorage.saveOfflineTripPack(storageUserId, pack);
      setRefreshKey((k) => k + 1);
      Alert.alert(
        isRefresh ? 'Pack Refreshed' : 'Downloaded',
        isRefresh
          ? 'Offline pack refreshed with latest server data. Any pending offline notes have been preserved.'
          : 'Trip pack saved locally! You can now access full details offline in airplane mode.'
      );
    } catch (err: any) {
      Alert.alert(
        isRefresh ? 'Refresh Failed' : 'Download Failed',
        getErrorMessage(err) || 'Could not fetch offline pack. Check your connection.'
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleSyncPending = async () => {
    if (!storageUserId || !tripId || pendingQueue.length === 0) return;
    setSyncing(true);
    try {
      const response = await syncOfflineChanges(tripId, pendingQueue);

      // Defensively clear acknowledged items if partial response, or entire queue
      const ackedIds = response?.acknowledgedIds || response?.syncedIds;
      await offlineStorage.clearPendingSyncQueue(storageUserId, tripId, ackedIds);

      // Invalidate live React Query keys for places and details
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.places(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.activity(tripId) });

      setRefreshKey((k) => k + 1);
      Alert.alert('Synchronized', 'Pending offline changes have been saved to the server!');
    } catch (err: any) {
      Alert.alert('Sync Error', getErrorMessage(err) || 'Failed to sync changes with server.');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenNoteModal = (place: any) => {
    if (!place?.id) {
      Alert.alert('Cannot Edit Note', 'This stop does not have a unique identifier.');
      return;
    }
    setSelectedPlace(place);
    setNoteText(place.note || '');
    setNoteModalVisible(true);
  };

  const handleSaveNote = async () => {
    if (!storageUserId || !tripId || !selectedPlace?.id) return;
    try {
      const success = await offlineStorage.updatePlaceNoteLocal(
        storageUserId,
        tripId,
        selectedPlace.id,
        noteText.trim()
      );

      if (success) {
        setNoteModalVisible(false);
        setRefreshKey((k) => k + 1);
        Alert.alert('Saved Offline', 'Note updated locally and queued for sync once back online.');
      } else {
        Alert.alert('Error', 'Failed to save note locally.');
      }
    } catch {
      Alert.alert('Error', 'Failed to save note locally.');
    }
  };

  const handleDeleteOffline = async (targetTripId: string) => {
    if (!storageUserId) return;

    // Check if target trip has unsynced changes
    const queue = await offlineStorage.getPendingSyncQueue(storageUserId, targetTripId);
    const hasUnsynced = queue.length > 0;

    const message = hasUnsynced
      ? `You have ${queue.length} unsynced offline edit(s) that will be permanently lost if you delete this offline pack. Are you sure you want to delete?`
      : 'Delete saved offline data for this trip?';

    Alert.alert('Remove Offline Data', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await offlineStorage.deleteOfflineTrip(storageUserId, targetTripId);
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
              <Ionicons name="cloud-offline" size={14} color={Theme.colors.status.warning} />
              <Text style={styles.offlineBadgeText}>Offline Companion</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={() => handleDownloadTrip(true)}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color={Theme.colors.accent} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={13} color={Theme.colors.accent} />
                    <Text style={styles.refreshBtnText}>Refresh Pack</Text>
                  </>
                )}
              </TouchableOpacity>

              {pendingQueue.length > 0 ? (
                <TouchableOpacity
                  style={styles.syncBtn}
                  onPress={handleSyncPending}
                  disabled={syncing}
                >
                  {syncing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="sync" size={13} color="#FFFFFF" />
                      <Text style={styles.syncBtnText}>Sync ({pendingQueue.length})</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <Text style={styles.tripTitle}>{tripBundle.trip.name}</Text>
          <Text style={styles.tripMeta}>
            {tripBundle.trip.destination} • {formatDateRange(tripBundle.trip.startDate, tripBundle.trip.endDate)}
          </Text>
          <Text style={styles.downloadedAt}>
            Pack downloaded: {formatDate(tripBundle.downloadedAt)}
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
              size={15}
              color={activeTab === 'itinerary' ? Theme.colors.accent : Theme.colors.textMuted}
            />
            <Text style={[styles.tabItemText, activeTab === 'itinerary' && styles.tabItemTextActive]}>
              Stops ({itinerary.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'stays' && styles.tabItemActive]}
            onPress={() => setActiveTab('stays')}
          >
            <Ionicons
              name="bed-outline"
              size={15}
              color={activeTab === 'stays' ? Theme.colors.accent : Theme.colors.textMuted}
            />
            <Text style={[styles.tabItemText, activeTab === 'stays' && styles.tabItemTextActive]}>
              Stays ({tripBundle.staysAndTransport?.length || 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'docs' && styles.tabItemActive]}
            onPress={() => setActiveTab('docs')}
          >
            <Ionicons
              name="document-text-outline"
              size={15}
              color={activeTab === 'docs' ? Theme.colors.accent : Theme.colors.textMuted}
            />
            <Text style={[styles.tabItemText, activeTab === 'docs' && styles.tabItemTextActive]}>
              Docs & Checklist
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'emergency' && styles.tabItemActive]}
            onPress={() => setActiveTab('emergency')}
          >
            <Ionicons
              name="medkit-outline"
              size={15}
              color={activeTab === 'emergency' ? Theme.colors.accent : Theme.colors.textMuted}
            />
            <Text style={[styles.tabItemText, activeTab === 'emergency' && styles.tabItemTextActive]}>
              Emergency
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === 'itinerary' ? (
            <View>
              {dayNums.length === 0 ? (
                <EmptyState
                  icon="map-outline"
                  title="No Stops in Itinerary"
                  message="This trip does not have any itinerary stops saved in the offline pack."
                />
              ) : (
                dayNums.map((day) => (
                  <View key={day} style={styles.daySection}>
                    <View style={styles.dayHeader}>
                      <View style={styles.dayBadge}>
                        <Text style={styles.dayBadgeText}>{day}</Text>
                      </View>
                      <Text style={styles.dayHeading}>Day {day}</Text>
                      <Text style={styles.daySub}>• {groupedDays[day].length} stop(s)</Text>
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
          ) : null}

          {activeTab === 'stays' ? (
            <View>
              {tripBundle.staysAndTransport && tripBundle.staysAndTransport.length > 0 ? (
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
                      {item.bookingRef ? (
                        <Text style={styles.bookingRef}>Ref: {item.bookingRef}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.stayName}>{item.name}</Text>
                    <Text style={styles.stayAddress}>{item.address || 'Address provided on arrival'}</Text>
                    {item.notes ? <Text style={styles.stayNotes}>{item.notes}</Text> : null}
                  </Card>
                ))
              ) : (
                <EmptyState
                  icon="bed-outline"
                  title="No Stays or Transport"
                  message="No hotel bookings or transportation legs recorded in this offline pack."
                />
              )}
            </View>
          ) : null}

          {activeTab === 'docs' ? (
            <View style={{ gap: 14 }}>
              {/* Checklist from Bundle */}
              <Card>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="checkbox-outline" size={18} color={Theme.colors.accent} />
                  <Text style={styles.cardHeaderTitle}>Packing & Preparation Checklist</Text>
                </View>
                {tripBundle.checklist && tripBundle.checklist.length > 0 ? (
                  tripBundle.checklist.map((item: any, idx: number) => (
                    <View key={item.id || idx} style={styles.checklistItemRow}>
                      <Ionicons
                        name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={item.completed ? Theme.colors.status.success : Theme.colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.checklistItemText,
                          item.completed ? styles.checklistItemCompleted : null,
                        ]}
                      >
                        {item.title || item.text || item.name}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyCardText}>No checklist items in pack.</Text>
                )}
              </Card>

              {/* Documents from Bundle */}
              <Card>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="folder-open-outline" size={18} color={Theme.colors.accent} />
                  <Text style={styles.cardHeaderTitle}>Travel Documents & Notes</Text>
                </View>
                {tripBundle.documents && tripBundle.documents.length > 0 ? (
                  tripBundle.documents.map((doc: any, idx: number) => (
                    <View key={doc.id || idx} style={styles.docItemRow}>
                      <Ionicons name="document-text-outline" size={16} color={Theme.colors.textSecondary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docTitle}>{doc.name || doc.title || 'Document'}</Text>
                        {doc.description ? <Text style={styles.docDesc}>{doc.description}</Text> : null}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyCardText}>No travel documents recorded in pack.</Text>
                )}
              </Card>
            </View>
          ) : null}

          {activeTab === 'emergency' ? (
            <View style={{ gap: 14 }}>
              <Card style={styles.emergencyCard}>
                <Ionicons name="warning-outline" size={24} color={Theme.colors.status.warning} />
                <Text style={styles.emergencyTitle}>Emergency & Helpline Guidance</Text>
                <Text style={styles.emergencyDesc}>
                  General Guidance: Check local emergency phone numbers for {tripBundle.trip.destination} before traveling. Emergency voice calls require active cellular network reception.
                </Text>
                <View style={styles.helplineRow}>
                  <Text style={styles.helplineLabel}>Standard International Guidance</Text>
                  <Text style={styles.helplineValue}>112 (GSM Standard)</Text>
                </View>
              </Card>

              {/* Saved Emergency Contacts from Bundle */}
              <Card>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="call-outline" size={18} color={Theme.colors.status.warning} />
                  <Text style={styles.cardHeaderTitle}>Saved Trip Emergency Contacts</Text>
                </View>
                {tripBundle.emergencyContacts && tripBundle.emergencyContacts.length > 0 ? (
                  tripBundle.emergencyContacts.map((contact: any, idx: number) => (
                    <View key={contact.id || idx} style={styles.contactRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactName}>{contact.name || 'Emergency Contact'}</Text>
                        {contact.relation ? <Text style={styles.contactRelation}>{contact.relation}</Text> : null}
                      </View>
                      <Text style={styles.contactPhone}>{contact.phone || contact.number}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyCardText}>No specific emergency contacts saved for this trip.</Text>
                )}
              </Card>
            </View>
          ) : null}
        </ScrollView>

        {/* Edit Note Modal */}
        <Modal
          visible={noteModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setNoteModalVisible(false)}
        >
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
            Save your complete trip details for reliable access when traveling abroad without cellular connectivity or in airplane mode.
          </Text>
        </View>

        {tripId && !tripBundle ? (
          <Card style={styles.downloadPromptCard}>
            <Ionicons name="download-outline" size={32} color={Theme.colors.accent} />
            <Text style={styles.downloadPromptTitle}>Download This Trip</Text>
            <Text style={styles.downloadPromptText}>
              Download the itinerary, stays, documents, and emergency contacts to access everything offline.
            </Text>
            <Button
              title={downloading ? 'Downloading Pack...' : 'Download Offline Pack'}
              onPress={() => handleDownloadTrip(false)}
              isLoading={downloading}
              style={{ marginTop: 14 }}
            />
          </Card>
        ) : null}

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Saved Offline Trips ({savedTrips.length})</Text>
        </View>

        {savedTrips.length === 0 ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="No Saved Offline Packs"
            message="When you download a trip, its pack will appear here for quick offline access."
          />
        ) : (
          savedTrips.map((st) => (
            <Card key={st.tripId} style={styles.savedTripCard}>
              <View style={styles.savedTripHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedTripName}>{st.name}</Text>
                  <Text style={styles.savedTripMeta}>
                    {st.destination} • {formatDateRange(st.startDate, st.endDate)}
                  </Text>
                  <Text style={styles.savedTripDownloaded}>
                    Downloaded: {formatDate(st.downloadedAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteOffline(st.tripId)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={Theme.colors.status.error} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
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
    paddingBottom: 32,
  },
  header: {
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    lineHeight: 18,
  },
  companionBanner: {
    backgroundColor: Theme.colors.surfaceElevated,
    padding: 16,
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
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  offlineBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.status.warning,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.accent,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  syncBtnText: {
    color: Theme.colors.accentText,
    fontSize: 12,
    fontWeight: '600',
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 2,
  },
  tripMeta: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  downloadedAt: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    paddingHorizontal: 8,
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
    color: Theme.colors.textMuted,
    fontWeight: '500',
  },
  tabItemTextActive: {
    color: Theme.colors.accent,
    fontWeight: '700',
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
    borderRadius: 12,
    backgroundColor: Theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    color: Theme.colors.accentText,
    fontSize: 12,
    fontWeight: '700',
  },
  dayHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  daySub: {
    fontSize: 13,
    color: Theme.colors.textMuted,
  },
  placeCard: {
    marginBottom: 10,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  categoryPill: {
    backgroundColor: Theme.colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryPillText: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  placeAddress: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: 8,
  },
  noteBox: {
    backgroundColor: Theme.colors.inputBackground,
    padding: 8,
    borderRadius: 6,
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
    color: Theme.colors.textPrimary,
  },
  editNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  editNoteBtnText: {
    fontSize: 12,
    color: Theme.colors.accent,
    fontWeight: '600',
  },
  stayCard: {
    marginBottom: 12,
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
    backgroundColor: 'rgba(167, 169, 154, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stayTypePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.accent,
    textTransform: 'capitalize',
  },
  bookingRef: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  stayName: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 4,
  },
  stayAddress: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  stayNotes: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontStyle: 'italic',
  },
  emergencyCard: {
    borderLeftWidth: 4,
    borderLeftColor: Theme.colors.status.warning,
    gap: 8,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  emergencyDesc: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
  },
  helplineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    marginTop: 4,
  },
  helplineLabel: {
    fontSize: 13,
    color: Theme.colors.textMuted,
  },
  helplineValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  checklistItemText: {
    fontSize: 13,
    color: Theme.colors.textPrimary,
    flex: 1,
  },
  checklistItemCompleted: {
    textDecorationLine: 'line-through',
    color: Theme.colors.textMuted,
  },
  docItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  docTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
  },
  docDesc: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
  },
  contactRelation: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  contactPhone: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.accent,
  },
  emptyCardText: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontStyle: 'italic',
  },
  downloadPromptCard: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 24,
  },
  downloadPromptTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  downloadPromptText: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionTitleRow: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  savedTripCard: {
    marginBottom: 12,
  },
  savedTripHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  savedTripName: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 4,
  },
  savedTripMeta: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  savedTripDownloaded: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
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
    fontSize: 14,
    color: Theme.colors.accent,
    marginBottom: 16,
  },
});
