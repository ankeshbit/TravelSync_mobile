import { Alert, AlertButton, AlertOptions, Platform } from 'react-native';

/**
 * Polyfills Alert.alert for React Native Web where Alert.alert is an empty no-op.
 * Supports single message alerts via window.alert and confirmation dialogs via window.confirm.
 */
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (
    title?: string | null,
    message?: string | null,
    buttons?: AlertButton[],
    _options?: AlertOptions
  ) => {
    const fullMessage = [title, message].filter(Boolean).join('\n\n');

    if (!buttons || buttons.length <= 1) {
      window.alert(fullMessage);
      if (buttons?.[0]?.onPress) {
        buttons[0].onPress();
      }
      return;
    }

    const confirmed = window.confirm(fullMessage);
    if (confirmed) {
      const confirmButton =
        buttons.find((b) => b.style === 'destructive') ||
        buttons.find((b) => b.style !== 'cancel') ||
        buttons[1];
      confirmButton?.onPress?.();
    } else {
      const cancelButton = buttons.find((b) => b.style === 'cancel');
      cancelButton?.onPress?.();
    }
  };
}
