import { getErrorMessage } from '@/api/client';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { BrandLogo } from '@/components/common/BrandLogo';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResetPassword = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, trimmed);
      setSubmitted(true);
    } catch (err: unknown) {
      // Non-enumerating messaging: if user not found, still treat as submitted
      const code = (err as { code?: string })?.code;
      if (code === 'auth/user-not-found') {
        setSubmitted(true);
      } else {
        setError(getErrorMessage(err) || 'Failed to send password reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={20} color={Theme.colors.textSecondary} />
          <Text style={styles.backButtonText}>Back to Sign In</Text>
        </TouchableOpacity>

        {/* Brand Header */}
        <BrandLogo
          size="xl"
          containerStyle={styles.header}
        />

        <View style={styles.card}>
          <View style={styles.formHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={26} color={Theme.colors.accent} />
            </View>
            <Text style={styles.formTitle}>Reset Password</Text>
            <Text style={styles.formSubtitle}>
              {submitted
                ? 'Check your inbox! We sent password reset instructions to your email.'
                : 'Enter your email address and we will send you a link to reset your password.'}
            </Text>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Theme.colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {submitted ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={48} color={Theme.colors.status.success} />
              <Text style={styles.successTitle}>Instructions Sent</Text>
              <Text style={styles.successDescription}>
                If an account exists for <Text style={styles.emailHighlight}>{email}</Text>, you will receive a reset link shortly.
              </Text>
              <Button
                title="Return to Sign In"
                onPress={() => router.replace('/(auth)/login')}
                style={styles.submitBtn}
              />
            </View>
          ) : (
            <>
              <Input
                label="Email Address"
                placeholder="e.g. explorer@travelsync.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<Ionicons name="mail-outline" size={18} color={Theme.colors.textMuted} />}
              />

              <Button
                title="Send Reset Link"
                onPress={handleResetPassword}
                isLoading={loading}
                style={styles.submitBtn}
                icon={<Ionicons name="mail" size={18} color={Theme.colors.accentText} />}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: Theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  logo: {
    width: 38,
    height: 38,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(167, 169, 154, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: Theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginBottom: 16,
  },
  errorText: {
    color: Theme.colors.status.error,
    fontSize: 13,
    flex: 1,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successTitle: {
    color: Theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  successDescription: {
    color: Theme.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emailHighlight: {
    color: Theme.colors.accent,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 8,
    width: '100%',
  },
});
