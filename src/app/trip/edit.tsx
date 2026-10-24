import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUpdateTrip, useDeleteTrip } from '@/hooks/useTrips';
import { markTripDeletedLocally } from '@/hooks/useTripSocket';
import { DatePickerField } from '@/components/common/DatePickerField';
import { validateTripForm, dateStringToISO } from '@/utils/tripValidation';

import { getErrorMessage } from '@/api/client';
import { useTrip } from '@/hooks/useTripDetails';
import { useIsTripOwner } from '@/hooks/useIsTripOwner';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { Theme } from '@/constants/theme';
import { Trip, TripStatus } from '@/types/trip';

const STATUS_OPTIONS: { id: TripStatus; label: string }[] = [
  { id: 'planning', label: 'Planning' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function EditTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = id || '';

  const { data: trip, isLoading, isError, refetch } = useTrip(tripId);

  if (isLoading) {
    return <LoadingState message="Loading trip details..." fullscreen />;
  }

  if (isError || !trip) {
    return (
      <ErrorState
        title="Trip Not Found"
        message="Could not load trip for editing."
        onRetry={refetch}
        fullscreen
      />
    );
  }

  return <EditTripForm trip={trip} key={trip.id} />;
}

function EditTripForm({ trip }: { trip: Trip }) {
  const router = useRouter();
  const isOwner = useIsTripOwner(trip);
  const updateTripMutation = useUpdateTrip(trip.id);
  const deleteTripMutation = useDeleteTrip();

  const [name, setName] = useState(trip.name || '');
  const [destination, setDestination] = useState(trip.destination || '');
  const [startDate, setStartDate] = useState(
    trip.startDate ? trip.startDate.split('T')[0] : ''
  );
  const [endDate, setEndDate] = useState(
    trip.endDate ? trip.endDate.split('T')[0] : ''
  );
  const [budget, setBudget] = useState(
    trip.budgetPerPerson ? String(trip.budgetPerPerson) : '0'
  );
  const [currency, setCurrency] = useState(trip.currency || 'INR');
  const [status, setStatus] = useState<TripStatus>(trip.status || 'planning');
  const [coverImageUrl, setCoverImageUrl] = useState(trip.coverImageUrl || '');



// Edit form is accessible while Danger Zone (Delete Trip) is gated on isOwner [BACKEND?]

  const handleUpdate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a trip name.');
      return;
    }
    if (!destination.trim()) {
      Alert.alert('Required', 'Please enter a destination.');
      return;
    }
    const validation = validateTripForm({ name, destination, startDate, endDate, budget, currency });
    if (!validation.valid) {
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }

    try {
      await updateTripMutation.mutateAsync({
        name: name.trim(),
        destination: destination.trim(),
        startDate: dateStringToISO(startDate),
        endDate: dateStringToISO(endDate),
        budgetPerPerson: budget.trim() !== '' ? parseFloat(budget) : 0,
        currency: currency.trim().toUpperCase() || 'INR',
        status,
        coverImageUrl: coverImageUrl.trim() !== '' ? coverImageUrl.trim() : null,
      });

      Alert.alert('Success', 'Trip updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  const handleDeleteTrip = () => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip? All places, itineraries, and expenses will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              markTripDeletedLocally(trip.id);
              await deleteTripMutation.mutateAsync(trip.id);
              Alert.alert('Deleted', 'Trip deleted successfully.');
              router.replace('/(tabs)');
            } catch (err: unknown) {
              Alert.alert('Error', getErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Edit Trip</Text>
        <Text style={styles.subtitle}>
          Update details, dates, and budget for your travel group
        </Text>

        <Input
          label="Trip Name"
          placeholder="e.g. Summer in Tokyo"
          value={name}
          onChangeText={setName}
        />

        <Input
          label="Destination"
          placeholder="e.g. Tokyo, Japan"
          value={destination}
          onChangeText={setDestination}
        />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <DatePickerField
              label="Start Date"
              value={startDate}
              onChange={setStartDate}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <DatePickerField
              label="End Date"
              value={endDate}
              onChange={setEndDate}
              minimumDate={startDate ? new Date(startDate) : undefined}
            />
          </View>
        </View>

        <View style={styles.row}>
          <Input
            label="Budget Per Person"
            placeholder="15000"
            value={budget}
            onChangeText={setBudget}
            keyboardType="numeric"
            containerStyle={{ flex: 2, marginRight: 8 }}
          />
          <Input
            label="Currency"
            placeholder="INR"
            value={currency}
            onChangeText={setCurrency}
            autoCapitalize="characters"
            maxLength={5}
            containerStyle={{ flex: 1, marginLeft: 8 }}
          />
        </View>

        <Text style={styles.fieldLabel}>Trip Status</Text>
        <View style={styles.statusOptionsRow}>
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.statusOptionPill,
                status === opt.id && styles.statusOptionPillActive,
              ]}
              onPress={() => setStatus(opt.id)}
            >
              <Text
                style={[
                  styles.statusOptionText,
                  status === opt.id && styles.statusOptionTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Cover Image URL (Optional)"
          placeholder="https://images.unsplash.com/..."
          value={coverImageUrl}
          onChangeText={setCoverImageUrl}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Button
          title="Save Changes"
          onPress={handleUpdate}
          isLoading={updateTripMutation.isPending}
          style={styles.saveBtn}
          icon={<Ionicons name="checkmark" size={18} color={Theme.colors.accentText} />}
        />

        {isOwner && (
          <View style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>Danger Zone</Text>
            <Text style={styles.dangerDesc}>
              Permanently delete this trip and all its associated itinerary and expense records.
            </Text>
            <Button
              title="Delete Trip"
              variant="danger"
              onPress={handleDeleteTrip}
              isLoading={deleteTripMutation.isPending}
              icon={<Ionicons name="trash-outline" size={16} color="#FFFFFF" />}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
    marginBottom: 8,
    marginTop: 4,
  },
  statusOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  statusOptionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  statusOptionPillActive: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  statusOptionTextActive: {
    color: Theme.colors.accentText,
  },
  saveBtn: {
    marginTop: 10,
  },
  accessContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Theme.colors.background,
  },
  accessTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  accessMessage: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  dangerZone: {
    marginTop: 36,
    padding: 16,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.status.error,
    marginBottom: 4,
  },
  dangerDesc: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    lineHeight: 16,
    marginBottom: 14,
  },
});
