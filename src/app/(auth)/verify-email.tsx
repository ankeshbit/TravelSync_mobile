import { getErrorMessage } from '@/api/client';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/common/Button';
import { BrandLogo } from '@/components/common/BrandLogo';
import { Theme } from '@/constants/theme';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { firebaseUser, logout, syncBackendUser, clearError } = useAuth();
  const params = useLocalSearchParams<{ justSent?: string }>();

  // Clear errors on mount
  useEffect(() => {
    clearError();
  }, [clearError]);

  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(params.justSent === 'true' ? 60 : 0);
  const isMountedRef = useRef(true);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cooldown countdown timer (isolated from verification polling)
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setTimeout(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Verification polling effect (runs at a consistent 5-second interval)
  useEffect(() => {
    // If not signed in at all, go to login
    if (!auth.currentUser) {
      router.replace('/(auth)/login');
      return;
    }
    // If already verified, go to dashboard
    if (auth.currentUser.emailVerified) {
      router.replace('/(tabs)');
      return;
    }

    let isPolling = true;

    const checkVerificationStatus = async () => {
      if (!isPolling || !isMountedRef.current || isCheckingRef.current) return;
      isCheckingRef.current = true;
      try {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified && isMountedRef.current && isPolling) {
            await auth.currentUser.getIdToken(true);
            await syncBackendUser();
            isPolling = false;
            router.replace('/(tabs)');
          }
        }
      } catch (err) {
        // Network or reload failures during background polling are handled gracefully
        console.warn('[verify-email] Background polling check warning:', err);
      } finally {
        isCheckingRef.current = false;
      }
    };

    const pollInterval = setInterval(checkVerificationStatus, 5000);

    return () => {
      isPolling = false;
      clearInterval(pollInterval);
    };
  }, [router, syncBackendUser]);

  const handleCheckVerification = async () => {
    if (!auth.currentUser) {
      router.replace('/(auth)/login');
      return;
    }

    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setChecking(true);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        await auth.currentUser.getIdToken(true);
        await syncBackendUser();
        if (isMountedRef.current) {
          Alert.alert('Verified!', 'Your email has been verified. Welcome to TravelSync!');
          router.replace('/(tabs)');
        }
      } else {
        if (isMountedRef.current) {
          Alert.alert(
            'Not Verified Yet',
            'Please check your email inbox and tap the link to verify your account.'
          );
        }
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        Alert.alert('Error', getErrorMessage(err) || 'Failed to check verification status.');
      }
    } finally {
      isCheckingRef.current = false;
      if (isMountedRef.current) {
        setChecking(false);
      }
    }
  };

  const handleResend = async () => {
    if (!auth.currentUser || resendCooldown > 0 || sending) return;

    setSending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      if (isMountedRef.current) {
        setResendCooldown(60);
        Alert.alert('Email Sent', 'A fresh verification link has been sent to your inbox.');
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        Alert.alert('Error', getErrorMessage(err) || 'Failed to resend verification email.');
      }
    } finally {
      if (isMountedRef.current) {
        setSending(false);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const email = firebaseUser?.email || auth.currentUser?.email || '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        {/* Brand Header */}
        <BrandLogo
          size="lg"
          containerStyle={styles.brandRow}
        />

        {/* Mail Icon Circle */}
        <View style={styles.iconCircle}>
          <Ionicons name="mail-unread-outline" size={36} color={Theme.colors.accent} />
        </View>

        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.subtitle}>We sent a verification link to:</Text>
        <Text style={styles.emailHighlight}>{email}</Text>

        <Text style={styles.instructions}>
          Please click the link in the email to activate full collaborative access on TravelSync. If you don&apos;t see it, check your spam or junk folder.
        </Text>

        <View style={styles.actions}>
          <Button
            title={checking ? 'Checking...' : "I've verified my email"}
            onPress={handleCheckVerification}
            isLoading={checking}
            icon={<Ionicons name="checkmark-circle" size={18} color={Theme.colors.accentText} />}
          />

          <Button
            title={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
            variant="outline"
            onPress={handleResend}
            disabled={resendCooldown > 0 || sending}
            isLoading={sending}
            icon={<Ionicons name="send-outline" size={16} color={Theme.colors.textPrimary} />}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={16} color={Theme.colors.textMuted} />
            <Text style={styles.logoutText}>Sign in with another account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  logo: {
    width: 32,
    height: 32,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(167, 169, 154, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167, 169, 154, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: Theme.colors.textMuted,
  },
  emailHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.accent,
    marginTop: 2,
    marginBottom: 16,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    width: '100%',
    alignItems: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoutText: {
    fontSize: 13,
    color: Theme.colors.textMuted,
  },
});
