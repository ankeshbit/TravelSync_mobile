import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Theme } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const isInteractive = !isLoading && !disabled;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        !isInteractive && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={!isInteractive}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? Theme.colors.accentText : Theme.colors.accent}
        />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, styles[`${variant}Text`], textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: Theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  primary: {
    backgroundColor: Theme.colors.accent,
  },
  secondary: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Theme.colors.borderStrong,
  },
  danger: {
    backgroundColor: Theme.colors.status.errorBg,
    borderWidth: 1,
    borderColor: Theme.colors.status.errorBorder,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  primaryText: {
    color: Theme.colors.accentText,
  },
  secondaryText: {
    color: Theme.colors.textPrimary,
  },
  outlineText: {
    color: Theme.colors.textPrimary,
  },
  dangerText: {
    color: Theme.colors.status.error,
  },
});
