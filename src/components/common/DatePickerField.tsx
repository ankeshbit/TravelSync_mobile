import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Input } from './Input';
import { Theme } from '@/constants/theme';
import { parseCalendarDate } from '@/utils/dateUtils';

interface DatePickerFieldProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  error?: string;
  minimumDate?: Date;
  placeholder?: string;
}

export function DatePickerField({
  label,
  value,
  onChange,
  error,
  minimumDate,
  placeholder = 'YYYY-MM-DD',
}: DatePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Fallback to text Input on Web
  if (Platform.OS === 'web') {
    return (
      <Input
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        error={error}
        leftIcon={<Ionicons name="calendar-outline" size={18} color={Theme.colors.textMuted} />}
      />
    );
  }

  const currentDate = parseCalendarDate(value) || new Date();

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      onChange(`${y}-${m}-${d}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.field, error ? styles.fieldError : null]}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={18} color={Theme.colors.accent} />
        <Text style={[styles.text, !value ? styles.placeholderText : null]}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {showPicker && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={handleDateChange}
          themeVariant="dark"
        />
      )}
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
    color: Theme.colors.textSecondary,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Theme.colors.inputBackground,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldError: {
    borderColor: Theme.colors.status.error,
  },
  text: {
    fontSize: 15,
    color: Theme.colors.textPrimary,
  },
  placeholderText: {
    color: Theme.colors.textMuted,
  },
  errorText: {
    fontSize: 12,
    color: Theme.colors.status.error,
    marginTop: 4,
  },
});
