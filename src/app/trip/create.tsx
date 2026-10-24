import React, { useState } from 'react';
import {
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCreateTrip } from '@/hooks/useTrips';
import { validateTripForm, buildDefaultDates, dateStringToISO } from '@/utils/tripValidation';
import { DatePickerField } from '@/components/common/DatePickerField';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Theme } from '@/constants/theme';

function getInitialDates() {
  const { startDate, endDate } = buildDefaultDates();
  return { start: startDate, end: endDate };
}

export default function CreateTripScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const params = useLocalSearchParams<{ destination?: string; name?: string }>();
  const createTripMutation = useCreateTrip();

  const [dates] = useState(getInitialDates);
  const [name, setName] = useState(params.name || (params.destination ? `Trip to ${params.destination}` : ''));
  const [destination, setDestination] = useState(params.destination || '');
  const [startDate, setStartDate] = useState(dates.start);
  const [endDate, setEndDate] = useState(dates.end);
  const [budget, setBudget] = useState('10000');
  const [currency, setCurrency] = useState('INR');

  React.useEffect(() => {
    if (!firebaseUser?.uid) return;
    AsyncStorage.getItem(`user_prefs_${firebaseUser.uid}`).then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.preferredCurrency) setCurrency(parsed.preferredCurrency);
        } catch {}
      }
    });
  }, [firebaseUser?.uid]);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a name for your trip.');
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
      const newTrip = await createTripMutation.mutateAsync({
        name: name.trim(),
        destination: destination.trim(),
        startDate: dateStringToISO(startDate),
        endDate: dateStringToISO(endDate),
        budgetPerPerson: parseFloat(String(budget)) || 0,
        currency: currency.trim().toUpperCase() || 'INR',
      });

      Alert.alert('Success', 'Trip created successfully!', [
        {
          text: 'Open Trip',
          onPress: () => router.replace({ pathname: '/trip/[id]', params: { id: newTrip.id } }),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create trip. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New Trip</Text>
        <Text style={styles.subtitle}>Fill in details to start collaborating with your travel group</Text>

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
            placeholder="10000"
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
            containerStyle={{ flex: 1, marginLeft: 8 }}
          />
        </View>

        <Button
          title="Create Trip"
          onPress={handleCreate}
          isLoading={createTripMutation.isPending}
          style={styles.submitBtn}
        />
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
  },
  submitBtn: {
    marginTop: 16,
  },
});
