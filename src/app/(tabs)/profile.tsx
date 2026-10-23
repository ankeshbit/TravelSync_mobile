import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { getApiBaseUrl } from '@/config/env';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Theme } from '@/constants/theme';
import { updateProfile, uploadProfilePhoto, sendDeleteOtp, deleteAccount } from '@/api/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, firebaseUser, logout, syncBackendUser, isLoading } = useAuth();

  // Profile edit state
  const [name, setName] = useState(user?.name || firebaseUser?.displayName || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(user?.picture || null);

  // OTP Modal state for account deletion
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Password reset
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleUpdateName = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    try {
      setIsUpdatingProfile(true);
      await updateProfile({ name: name.trim() });
      await syncBackendUser();
      Alert.alert('Success', 'Profile name updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update profile name.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePickAndUploadPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Permission to access photos is required to update avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setIsUploadingPhoto(true);

      const formData = new FormData();
      const filename = asset.uri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('photo', {
        uri: Platform.OS === 'ios' ? asset.uri.replace('file://', '') : asset.uri,
        name: filename,
        type,
      } as any);

      const res = await uploadProfilePhoto(formData);
      if (res?.picture) {
        setProfilePicture(res.picture);
      }
      await syncBackendUser();
      Alert.alert('Success', 'Profile photo updated successfully!');
    } catch (err: any) {
      Alert.alert('Upload Error', err?.response?.data?.message || 'Failed to upload profile photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePasswordReset = async () => {
    const email = user?.email || firebaseUser?.email;
    if (!email) {
      Alert.alert('Error', 'No email address associated with this account.');
      return;
    }

    try {
      setIsSendingReset(true);
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Reset Link Sent', `Password reset instructions sent to ${email}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send password reset email.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleStartDeleteAccount = async () => {
    const email = user?.email || firebaseUser?.email;
    if (!email) {
      Alert.alert('Error', 'No email address found for this account.');
      return;
    }

    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, trips, places, and expenses. A verification code will be sent to your email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Code',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSendingOtp(true);
              const res = await sendDeleteOtp(email);
              if (res?.devOtp) {
                setDevOtp(res.devOtp);
              }
              setDeleteModalVisible(true);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to send OTP verification code.');
            } finally {
              setIsSendingOtp(false);
            }
          },
        },
      ]
    );
  };

  const handleConfirmDelete = async () => {
    if (!otpCode.trim()) {
      Alert.alert('Required', 'Please enter the 6-digit verification code.');
      return;
    }

    try {
      setIsDeleting(true);
      await deleteAccount(otpCode.trim());
      setDeleteModalVisible(false);
      await logout();
      Alert.alert('Account Deleted', 'Your TravelSync account has been permanently removed.');
      router.replace('/(auth)/login');
    } catch (err: any) {
      Alert.alert('Deletion Failed', err?.response?.data?.message || 'Invalid or expired OTP code.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from TravelSync Mobile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const displayName = name || user?.name || firebaseUser?.displayName || 'Traveler';
  const email = user?.email || firebaseUser?.email || 'N/A';
  const isEmailVerified = firebaseUser?.emailVerified === true;
  const isDbSynced = Boolean(user?.id);

  // Profile image URL handling (relative vs absolute)
  const fullAvatarUrl = profilePicture
    ? profilePicture.startsWith('http')
      ? profilePicture
      : `${getApiBaseUrl().replace(/\/api$/, '')}${profilePicture}`
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Avatar & Header */}
      <Card style={styles.profileCard}>
        <View style={styles.avatarWrapper}>
          {fullAvatarUrl ? (
            <Image source={{ uri: fullAvatarUrl }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.cameraButton}
            onPress={handlePickAndUploadPhoto}
            disabled={isUploadingPhoto}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isUploadingPhoto ? 'hourglass-outline' : 'camera'}
              size={14}
              color={Theme.colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{email}</Text>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, isEmailVerified ? styles.badgeSuccess : styles.badgeWarning]}>
            <Ionicons
              name={isEmailVerified ? 'checkmark-circle' : 'alert-circle'}
              size={13}
              color={isEmailVerified ? Theme.colors.status.success : Theme.colors.status.warning}
            />
            <Text style={[styles.badgeText, isEmailVerified ? styles.textSuccess : styles.textWarning]}>
              {isEmailVerified ? 'Email Verified' : 'Email Unverified'}
            </Text>
          </View>

          <View style={[styles.badge, isDbSynced ? styles.badgeSuccess : styles.badgeWarning]}>
            <Ionicons
              name={isDbSynced ? 'server' : 'cloud-offline'}
              size={13}
              color={isDbSynced ? Theme.colors.status.success : Theme.colors.status.warning}
            />
            <Text style={[styles.badgeText, isDbSynced ? styles.textSuccess : styles.textWarning]}>
              {isDbSynced ? 'PostgreSQL Synced' : 'Sync Pending'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Edit Profile Section */}
      <Text style={styles.sectionTitle}>Profile Information</Text>
      <Card style={styles.cardSection}>
        <Input
          label="Full Name"
          placeholder="e.g. Explorer Name"
          value={name}
          onChangeText={setName}
          leftIcon={<Ionicons name="person-outline" size={18} color={Theme.colors.textMuted} />}
        />
        <Input
          label="Email Address"
          value={email}
          editable={false}
          leftIcon={<Ionicons name="mail-outline" size={18} color={Theme.colors.textMuted} />}
          helperText="Managed by Firebase Authentication."
        />
        <Button
          title="Save Changes"
          onPress={handleUpdateName}
          isLoading={isUpdatingProfile}
          style={styles.saveBtn}
          icon={<Ionicons name="save-outline" size={18} color={Theme.colors.accentText} />}
        />
      </Card>

      {/* Security & Authentication */}
      <Text style={styles.sectionTitle}>Security & Access</Text>
      <Card style={styles.cardSection}>
        <View style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Theme.colors.accent} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Authentication Provider</Text>
            <Text style={styles.settingDesc}>
              {firebaseUser?.providerData?.[0]?.providerId === 'google.com'
                ? 'Google OAuth 2.0 (Active)'
                : 'Firebase Email & Password (Active)'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Ionicons name="key-outline" size={20} color={Theme.colors.textMuted} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Password Recovery</Text>
            <Text style={styles.settingDesc}>Send reset link to your email</Text>
          </View>
          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={handlePasswordReset}
            disabled={isSendingReset}
          >
            <Text style={styles.actionBtnOutlineText}>
              {isSendingReset ? 'Sending...' : 'Send Link'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Preferences */}
      <Text style={styles.sectionTitle}>Preferences</Text>
      <Card style={styles.cardSection}>
        <View style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Ionicons name="cash-outline" size={20} color={Theme.colors.accent} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Supported Currencies</Text>
            <Text style={styles.settingDesc}>USD ($) · EUR (€) · INR (₹)</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Ionicons name="color-palette-outline" size={20} color={Theme.colors.accent} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Visual Theme</Text>
            <Text style={styles.settingDesc}>Charcoal / Carbon Dark Mode</Text>
          </View>
        </View>
      </Card>

      {/* Danger Zone */}
      <Text style={[styles.sectionTitle, { color: Theme.colors.status.error }]}>Danger Zone</Text>
      <Card style={[styles.cardSection, styles.dangerCard]}>
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Ionicons name="trash-outline" size={20} color={Theme.colors.status.error} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: Theme.colors.status.error }]}>
              Delete Account
            </Text>
            <Text style={styles.settingDesc}>
              Permanently delete all your trips, places, and records.
            </Text>
          </View>
        </View>

        <Button
          title={isSendingOtp ? 'Sending OTP...' : 'Delete Account with OTP'}
          variant="danger"
          onPress={handleStartDeleteAccount}
          isLoading={isSendingOtp}
          style={{ marginTop: 14 }}
        />
      </Card>

      {/* Sign Out Button */}
      <View style={{ marginTop: 24 }}>
        <Button
          title="Sign Out"
          variant="outline"
          onPress={handleLogout}
          isLoading={isLoading}
          icon={<Ionicons name="log-out-outline" size={18} color={Theme.colors.textPrimary} />}
        />
      </View>

      {/* Delete OTP Verification Modal */}
      <Modal visible={deleteModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="warning-outline" size={22} color={Theme.colors.status.error} />
                <Text style={styles.modalTitle}>Confirm Account Deletion</Text>
              </View>
              <TouchableOpacity onPress={() => setDeleteModalVisible(false)}>
                <Ionicons name="close" size={22} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Please enter the 6-digit verification code sent to <Text style={{ color: Theme.colors.accent }}>{email}</Text>.
            </Text>

            {devOtp && (
              <View style={styles.devOtpBanner}>
                <Text style={styles.devOtpTitle}>DEV OTP Code (Development Server):</Text>
                <Text style={styles.devOtpCode}>{devOtp}</Text>
              </View>
            )}

            <Input
              label="6-Digit OTP Code"
              placeholder="e.g. 123456"
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
              maxLength={6}
              leftIcon={<Ionicons name="key-outline" size={18} color={Theme.colors.textMuted} />}
            />

            <View style={{ gap: 10, marginTop: 8 }}>
              <Button
                title="Permanently Delete My Account"
                variant="danger"
                onPress={handleConfirmDelete}
                isLoading={isDeleting}
              />
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setDeleteModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Theme.colors.border,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: Theme.colors.accentText,
  },
  cameraButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  email: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    marginTop: 4,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(134, 169, 139, 0.12)',
    borderColor: 'rgba(134, 169, 139, 0.25)',
  },
  badgeWarning: {
    backgroundColor: 'rgba(196, 163, 107, 0.12)',
    borderColor: 'rgba(196, 163, 107, 0.25)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textSuccess: {
    color: Theme.colors.status.success,
  },
  textWarning: {
    color: Theme.colors.status.warning,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  cardSection: {
    marginBottom: 20,
    padding: 16,
  },
  saveBtn: {
    marginTop: 6,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
  },
  settingDesc: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.border,
    marginVertical: 14,
  },
  actionBtnOutline: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surfaceElevated,
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
  },
  dangerCard: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.status.error,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  devOtpBanner: {
    backgroundColor: 'rgba(167, 169, 154, 0.12)',
    padding: 10,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(167, 169, 154, 0.3)',
    marginBottom: 14,
    alignItems: 'center',
  },
  devOtpTitle: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginBottom: 2,
  },
  devOtpCode: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
    color: Theme.colors.accent,
  },
});
