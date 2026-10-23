import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { GoogleLogo } from './GoogleLogo';
import { Theme } from '@/constants/theme';

interface GoogleButtonProps {
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function GoogleButton({
  onPress,
  isLoading = false,
  disabled = false,
  style,
}: GoogleButtonProps) {
  const isInteractive = !isLoading && !disabled;

  return (
    <TouchableOpacity
      style={[styles.button, !isInteractive && styles.disabled, style]}
      onPress={onPress}
      disabled={!isInteractive}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={Theme.colors.accent} />
      ) : (
        <>
          <GoogleLogo size={20} />
          <Text style={styles.text}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 50,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
    letterSpacing: -0.2,
  },
});
