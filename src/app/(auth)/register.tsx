import React, { useState } from 'react';
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
import { Theme } from '@/constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { registerWithEmail, loginWithGoogle, isLoading, error, clearError } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleRegister = async () => {
    clearError();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setValidationError('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    try {
      await registerWithEmail(name, email, password);
      router.replace('/(tabs)');
    } catch {
      // Error handled by AuthContext
    }
  };

  const handleGoogleSignup = async () => {
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

  const displayError = validationError || error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Theme.colors.textPrimary} />
        </TouchableOpacity>

        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>Travel Sync</Text>
        </View>

        {/* Form Card (Charcoal Surface) */}
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Create Account</Text>
            <Text style={styles.formSubtitle}>Join TravelSync to plan and collaborate seamlessly.</Text>
          </View>

          {/* Quick Sign Up with Google */}
          <GoogleButton
            onPress={handleGoogleSignup}
            isLoading={loadingGoogle}
            style={styles.googleBtn}
          />

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR SIGN UP WITH EMAIL</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Error Banner */}
          {displayError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Theme.colors.status.error} />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          <Input
            label="Full Name"
            placeholder="John Doe"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (validationError) setValidationError(null);
            }}
            leftIcon={<Ionicons name="person-outline" size={18} color={Theme.colors.textMuted} />}
          />

          <Input
            label="Email Address"
            placeholder="you@example.com"
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

          <Input
            label="Password"
            placeholder="At least 6 characters"
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

          <Input
            label="Confirm Password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (validationError) setValidationError(null);
            }}
            secureTextEntry={!showPassword}
            leftIcon={<Ionicons name="shield-outline" size={18} color={Theme.colors.textMuted} />}
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            isLoading={isLoading && !loadingGoogle}
            style={styles.registerButton}
            icon={<Ionicons name="arrow-forward" size={18} color={Theme.colors.accentText} />}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.verificationNote}>
          <Ionicons name="mail-outline" size={16} color={Theme.colors.textMuted} />
          <Text style={styles.verificationText}>
            A verification link will be sent to your email to activate all collaborative trip features.
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
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  logo: {
    width: 38,
    height: 38,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  formCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 4,
  },
  formHeader: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    letterSpacing: -0.4,
  },
  formSubtitle: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  googleBtn: {
    marginBottom: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
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
    backgroundColor: 'rgba(199, 127, 120, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(199, 127, 120, 0.3)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: Theme.colors.status.error,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  registerButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: Theme.colors.textSecondary,
    fontSize: 13,
  },
  footerLink: {
    color: Theme.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  verificationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 14,
    borderRadius: 12,
    marginTop: 20,
    gap: 10,
  },
  verificationText: {
    flex: 1,
    fontSize: 12,
    color: Theme.colors.textMuted,
    lineHeight: 18,
  },
});
