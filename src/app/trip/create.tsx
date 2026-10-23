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
import { useRouter } from 'expo-router';
import { useCreateTrip } from '@/hooks/useTrips';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Theme } from '@/constants/theme';

function getInitialDates() {
  const now = new Date();
  const start = now.toISOString().split('T')[0];
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const end = nextWeek.toISOString().split('T')[0];
  return { start, end };
}

export default function CreateTripScreen() {
  const router = useRouter();
  const createTripMutation = useCreateTrip();

  const [dates] = useState(getInitialDates);
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(dates.start);
  const [endDate, setEndDate] = useState(dates.end);
  const [budget, setBudget] = useState('10000');
  const [currency, setCurrency] = useState('INR');

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a name for your trip.');
      return;
    }
    if (!destination.trim()) {
      Alert.alert('Required', 'Please enter a destination.');
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert('Required', 'Please enter both start and end dates.');
      return;
    }

    try {
      const newTrip = await createTripMutation.mutateAsync({
        name: name.trim(),
        destination: destination.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        budgetPerPerson: parseFloat(budget) || 0,
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
          <Input
            label="Start Date (YYYY-MM-DD)"
            placeholder="2026-06-01"
            value={startDate}
            onChangeText={setStartDate}
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <Input
            label="End Date (YYYY-MM-DD)"
            placeholder="2026-06-08"
            value={endDate}
            onChangeText={setEndDate}
            containerStyle={{ flex: 1, marginLeft: 8 }}
          />
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
