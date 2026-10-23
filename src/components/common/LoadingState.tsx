import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Theme } from '@/constants/theme';
import { BrandLogo } from '@/components/common/BrandLogo';

interface LoadingStateProps {
  message?: string;
  fullscreen?: boolean;
  showBrand?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LoadingState({
  message = 'Loading...',
  fullscreen = false,
  showBrand,
  style,
}: LoadingStateProps) {
  // If explicitly requested, or if fullscreen, or if message references TravelSync, display BrandLogo
  const shouldShowBrand =
    showBrand !== undefined
      ? showBrand
      : fullscreen || (message ? /travelsync/i.test(message) : false);

  return (
    <View style={[styles.container, fullscreen && styles.fullscreen, style]}>
      {shouldShowBrand && (
        <BrandLogo
          size="lg"
          containerStyle={styles.brand}
        />
      )}
      <ActivityIndicator size="large" color={Theme.colors.accent} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreen: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  brand: {
    marginBottom: 24,
  },
  message: {
    marginTop: 14,
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
});
