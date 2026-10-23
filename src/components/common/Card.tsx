import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Theme } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
});
