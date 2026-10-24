import '@/utils/alertPolyfill';
import React, { useEffect, Component, ErrorInfo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Theme } from '@/constants/theme';
import { BrandLogo } from '@/components/common/BrandLogo';

// Prevent native splash screen from hiding automatically until Auth is initialized
SplashScreen.preventAutoHideAsync().catch(() => {});

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

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RootErrorBoundary] Unhandled UI error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={56} color={Theme.colors.status.error} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || 'An unexpected error occurred while rendering the view.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={18} color={Theme.colors.accentText} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// Expo Router native error boundary export
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={56} color={Theme.colors.status.error} />
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>
        {error?.message || 'An unexpected error occurred while loading this screen.'}
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={retry} activeOpacity={0.8}>
        <Ionicons name="refresh-outline" size={18} color={Theme.colors.accentText} />
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

function NavigationStack() {
  const { isInitializing } = useAuth();

  useEffect(() => {
    if (!isInitializing) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isInitializing]);

  return (
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
          headerRight: () => <BrandLogo size="xs" showText={false} />,
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
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <NavigationStack />
          </AuthProvider>
        </QueryClientProvider>
      </RootErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 320,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Theme.borderRadius.md,
    gap: 8,
  },
  retryButtonText: {
    color: Theme.colors.accentText,
    fontWeight: '600',
    fontSize: 15,
  },
});
