import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'airplane-outline',
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={Theme.colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.button} onPress={onAction} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color={Theme.colors.accentText} style={styles.btnIcon} />
          <Text style={styles.buttonText}>{actionLabel}</Text>
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
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
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
    maxWidth: 300,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 11,
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
