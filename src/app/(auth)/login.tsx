import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { GoogleButton } from '@/components/common/GoogleButton';
import { LoadingState } from '@/components/common/LoadingState';
import { Theme } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithEmail, loginWithGoogle, firebaseUser, isInitializing, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (firebaseUser) {
      router.replace('/(tabs)');
    }
  }, [firebaseUser, router]);

  const handleEmailLogin = async () => {
    clearError();
    setValidationError(null);

    if (!email.trim()) {
      setValidationError('Please enter your email address.');
      return;
    }
    if (!password) {
      setValidationError('Please enter your password.');
      return;
    }

    try {
      await loginWithEmail(email, password);
      router.replace('/(tabs)');
    } catch {
      // Error handled by AuthContext
    }
  };

  const handleGoogleLogin = async () => {
    clearError();
    setValidationError(null);
    setLoadingGoogle(true);
    try {
      const user = await loginWithGoogle();
      if (user) {
        router.replace('/(tabs)');
      }
    } catch {
      // Error handled by AuthContext
    } finally {
      setLoadingGoogle(false);
    }
  };

  if (isInitializing) {
    return <LoadingState message="Checking session..." fullscreen />;
  }

  const displayError = validationError || error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Official Brand Header */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>Travel Sync</Text>
        </View>

        {/* Form Container (Carbon Card Surface) */}
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Welcome Back</Text>
            <Text style={styles.formSubtitle}>Sign in to continue your global adventure.</Text>
          </View>

          {/* Google Sign-In (Primary Option) */}
          <GoogleButton
            onPress={handleGoogleLogin}
            isLoading={loadingGoogle}
            style={styles.googleBtn}
          />

          {/* Divider matching website */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR SIGN IN WITH EMAIL</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Error Banner */}
          {displayError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Theme.colors.status.error} />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          {/* Email Input */}
          <Input
            label="Email Address"
            placeholder="e.g. explorer@travelsync.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (validationError) setValidationError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={<Ionicons name="mail-outline" size={18} color={Theme.colors.textMuted} />}
          />

          {/* Password Input */}
          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (validationError) setValidationError(null);
            }}
            secureTextEntry={!showPassword}
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Theme.colors.textMuted} />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Theme.colors.textMuted}
                />
              </TouchableOpacity>
            }
          />

          {/* Sign In Button (Sage Accent) */}
          <Button
            title="Sign In"
            onPress={handleEmailLogin}
            isLoading={isLoading && !loadingGoogle}
            style={styles.submitBtn}
            icon={<Ionicons name="arrow-forward" size={18} color={Theme.colors.accentText} />}
          />

          {/* Sign Up Link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Security / Architecture Footer */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Theme.colors.textMuted} />
          <Text style={styles.securityText}>
            Secured by Firebase Auth & verified against TravelSync API.
          </Text>
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
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 28,
  },
  logo: {
    width: 44,
    height: 44,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  formCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  formHeader: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    lineHeight: 20,
  },
  googleBtn: {
    marginBottom: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Theme.colors.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.textMuted,
    letterSpacing: 0.8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.status.errorBg,
    borderWidth: 1,
    borderColor: Theme.colors.status.errorBorder,
    padding: 12,
    borderRadius: Theme.borderRadius.md,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: Theme.colors.status.error,
    fontSize: 13,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: 8,
    marginBottom: 18,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
  },
  footerLink: {
    color: Theme.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 6,
  },
  securityText: {
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
});
