import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Theme } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  label,
  error,
  containerStyle,
  style,
  leftIcon,
  rightIcon,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          Boolean(error) && styles.inputError,
        ]}
      >
        {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
        <TextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : undefined,
            rightIcon ? styles.inputWithRightIcon : undefined,
            style,
          ]}
          placeholderTextColor={Theme.colors.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  inputWrapper: {
    height: 48,
    backgroundColor: Theme.colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  inputFocused: {
    borderColor: Theme.colors.borderFocus,
  },
  inputError: {
    borderColor: Theme.colors.status.error,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 15,
    color: Theme.colors.textPrimary,
  },
  inputWithLeftIcon: {
    paddingLeft: 42,
  },
  inputWithRightIcon: {
    paddingRight: 42,
  },
  iconLeft: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  iconRight: {
    position: 'absolute',
    right: 14,
    zIndex: 1,
  },
  errorText: {
    fontSize: 12,
    color: Theme.colors.status.error,
    marginTop: 5,
    fontWeight: '500',
  },
});
