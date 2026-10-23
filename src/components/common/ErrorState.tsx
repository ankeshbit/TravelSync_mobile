import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  fullscreen?: boolean;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'Failed to load data. Please check your connection or backend server.',
  onRetry,
  fullscreen = false,
}: ErrorStateProps) {
  return (
    <View style={[styles.container, fullscreen && styles.fullscreen]}>
      <View style={styles.iconCircle}>
        <Ionicons name="alert-circle-outline" size={32} color={Theme.colors.status.error} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.8}>
          <Ionicons name="refresh" size={16} color={Theme.colors.accentText} style={styles.btnIcon} />
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      ) : null}
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
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.status.errorBg,
    borderWidth: 1,
    borderColor: Theme.colors.status.errorBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 320,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Theme.borderRadius.md,
  },
  btnIcon: {
    marginRight: 6,
  },
  buttonText: {
    color: Theme.colors.accentText,
    fontWeight: '600',
    fontSize: 14,
  },
});
