import '@/utils/alertPolyfill';
import React from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/context/AuthContext';
import { Theme } from '@/constants/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const status = error?.response?.status || error?.status;
        if (status === 401 || status === 403 || status === 404) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: Theme.colors.surfaceElevated },
              headerTintColor: Theme.colors.textPrimary,
              headerTitleStyle: { fontWeight: '700', color: Theme.colors.textPrimary },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: Theme.colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen
              name="trip/[id]"
              options={{
                title: 'Trip Details',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="trip/expenses"
              options={{
                title: 'Trip Expenses',
                headerBackTitle: 'Trip',
              }}
            />
            <Stack.Screen
              name="trip/map"
              options={{
                title: 'Map & Itinerary',
                headerBackTitle: 'Trip',
              }}
            />
            <Stack.Screen
              name="trip/offline"
              options={{
                title: 'Offline Companion',
                headerBackTitle: 'Trip',
              }}
            />
            <Stack.Screen
              name="trip/edit"
              options={{
                title: 'Edit Trip',
                headerBackTitle: 'Trip',
              }}
            />
            <Stack.Screen
              name="trip/create"
              options={{
                presentation: 'modal',
                title: 'Plan New Trip',
              }}
            />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
