import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  bgColor?: string;
}

export function StatCard({
  label,
  value,
  icon,
  color = Theme.colors.accent,
  bgColor,
}: StatCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconContainer, bgColor ? { backgroundColor: bgColor } : undefined]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.value} numberOfLines={1}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
