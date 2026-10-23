import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';

interface LoadingStateProps {
  message?: string;
  fullscreen?: boolean;
}

export function LoadingState({ message = 'Loading...', fullscreen = false }: LoadingStateProps) {
  return (
    <View style={[styles.container, fullscreen && styles.fullscreen]}>
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
  message: {
    marginTop: 12,
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontWeight: '500',
  },
});
