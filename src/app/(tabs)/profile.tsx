import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  Platform,
  Switch,
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
import { BrandLogo } from '@/components/common/BrandLogo';
import { Theme } from '@/constants/theme';
import { updateProfile, uploadProfilePhoto, sendDeleteOtp, deleteAccount } from '@/api/auth';

type SettingsTab = 'profile' | 'security' | 'preferences' | 'notifications' | 'account';

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: any }[] = [
  { id: 'profile', label: 'Profile', icon: 'person-outline' },
  { id: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
  { id: 'preferences', label: 'Preferences', icon: 'options-outline' },
  { id: 'notifications', label: 'Alerts', icon: 'notifications-outline' },
  { id: 'account', label: 'Account', icon: 'settings-outline' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD'];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, firebaseUser, logout, syncBackendUser, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Profile edit state
  const [name, setName] = useState(user?.name || firebaseUser?.displayName || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(user?.picture || null);

  // Preferences & Notifications State
  const [preferredCurrency, setPreferredCurrency] = useState('USD');
  const [notifyTripUpdates, setNotifyTripUpdates] = useState(true);
  const [notifyExpenseAlerts, setNotifyExpenseAlerts] = useState(true);
  const [notifyLiveActivity, setNotifyLiveActivity] = useState(true);

  // OTP Modal state for account deletion
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Password reset
  const [isSendingReset, setIsSendingReset] = useState(false);

  const memberSinceFormatted = useMemo(() => {
    const rawDate = (user as any)?.createdAt || firebaseUser?.metadata?.creationTime;
    if (!rawDate) return 'Member';
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return 'Member';
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [user, firebaseUser]);

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
      // 409 Conflict: user owns shared trips
      if (err?.response?.status === 409 || err?.response?.data?.code === 'OWNS_SHARED_TRIPS') {
        const tripNames = err.response.data?.trips?.join(', ') || 'one or more shared trips';
        Alert.alert(
          'Cannot Delete Account',
          `You are the owner of shared trips (${tripNames}). Please delete these trips or transfer ownership to another member before deleting your account.`
        );
      } else {
        Alert.alert('Deletion Failed', err?.response?.data?.message || 'Invalid or expired OTP code.');
      }
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
    <View style={styles.container}>
      {/* Header Profile Summary */}
      <View style={styles.topHeader}>
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
              size={12}
              color={isEmailVerified ? Theme.colors.status.success : Theme.colors.status.warning}
            />
            <Text style={[styles.badgeText, isEmailVerified ? styles.textSuccess : styles.textWarning]}>
              {isEmailVerified ? 'Verified' : 'Unverified'}
            </Text>
          </View>

          <View style={[styles.badge, isDbSynced ? styles.badgeSuccess : styles.badgeWarning]}>
            <Ionicons
              name={isDbSynced ? 'server' : 'cloud-offline'}
              size={12}
              color={isDbSynced ? Theme.colors.status.success : Theme.colors.status.warning}
            />
            <Text style={[styles.badgeText, isDbSynced ? styles.textSuccess : styles.textWarning]}>
              {isDbSynced ? 'PostgreSQL Synced' : 'Sync Pending'}
            </Text>
          </View>
        </View>
      </View>

      {/* 5 Sub-Tabs Navigation */}
      <View style={styles.tabNavContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabNavContent}>
          {SETTINGS_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.subTabItem, isActive && styles.subTabItemActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={isActive ? Theme.colors.accentText : Theme.colors.textMuted}
                />
                <Text style={[styles.subTabItemText, isActive && styles.subTabItemTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* TAB 1: PROFILE */}
        {activeTab === 'profile' && (
          <View style={styles.tabSection}>
            <Text style={styles.sectionHeading}>Profile Information</Text>
            <Card style={styles.cardSection}>
              <Input
                label="Full Name"
                placeholder="e.g. Rajnish Srivastava"
                value={name}
                onChangeText={setName}
                leftIcon={<Ionicons name="person-outline" size={18} color={Theme.colors.textMuted} />}
              />
              <Input
                label="Email Address"
                value={email}
                editable={false}
                leftIcon={<Ionicons name="mail-outline" size={18} color={Theme.colors.textMuted} />}
                helperText="Primary email is managed by your authentication provider."
              />

              {/* Member Since Date */}
              <View style={styles.memberSinceRow}>
                <Ionicons name="calendar-outline" size={18} color={Theme.colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberSinceLabel}>Member Since</Text>
                  <Text style={styles.memberSinceValue}>{memberSinceFormatted}</Text>
                </View>
              </View>

              <Button
                title="Save Changes"
                onPress={handleUpdateName}
                isLoading={isUpdatingProfile}
                style={styles.saveBtn}
                icon={<Ionicons name="save-outline" size={18} color={Theme.colors.accentText} />}
              />
            </Card>
          </View>
        )}

        {/* TAB 2: SECURITY */}
        {activeTab === 'security' && (
          <View style={styles.tabSection}>
            <Text style={styles.sectionHeading}>Security & Authentication</Text>
            <Card style={styles.cardSection}>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={Theme.colors.accent} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Authentication Provider</Text>
                  <Text style={styles.settingDesc}>
                    {firebaseUser?.providerData?.[0]?.providerId === 'google.com'
                      ? 'Google OAuth 2.0 (Active & Verified)'
                      : 'Firebase Email & Password (Active)'}
                  </Text>
                </View>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>Active</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Ionicons name="key-outline" size={20} color={Theme.colors.textMuted} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Password Recovery</Text>
                  <Text style={styles.settingDesc}>Send password reset instructions to {email}</Text>
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
          </View>
        )}

        {/* TAB 3: PREFERENCES */}
        {activeTab === 'preferences' && (
          <View style={styles.tabSection}>
            <Text style={styles.sectionHeading}>Preferences</Text>
            <Card style={styles.cardSection}>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Ionicons name="color-palette-outline" size={20} color={Theme.colors.accent} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Visual Theme</Text>
                  <Text style={styles.settingDesc}>Charcoal / Carbon Dark Mode (Default)</Text>
                </View>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>Dark</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={{ paddingTop: 8 }}>
                <Text style={styles.fieldLabel}>Default Display Currency</Text>
                <View style={styles.currencyPillsRow}>
                  {CURRENCIES.map((curr) => {
                    const isSelected = preferredCurrency === curr;
                    return (
                      <TouchableOpacity
                        key={curr}
                        style={[styles.currencyPill, isSelected && styles.currencyPillActive]}
                        onPress={() => setPreferredCurrency(curr)}
                      >
                        <Text style={[styles.currencyPillText, isSelected && styles.currencyPillTextActive]}>
                          {curr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* TAB 4: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <View style={styles.tabSection}>
            <Text style={styles.sectionHeading}>Notifications & Alerts</Text>
            <Card style={styles.cardSection}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.settingTitle}>Trip Updates</Text>
                  <Text style={styles.settingDesc}>Get notified about itinerary stop changes and member invites</Text>
                </View>
                <Switch
                  value={notifyTripUpdates}
                  onValueChange={setNotifyTripUpdates}
                  trackColor={{ false: Theme.colors.border, true: Theme.colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.settingTitle}>Expense Alerts</Text>
                  <Text style={styles.settingDesc}>Get notified when new shared expenses or debt settlements are logged</Text>
                </View>
                <Switch
                  value={notifyExpenseAlerts}
                  onValueChange={setNotifyExpenseAlerts}
                  trackColor={{ false: Theme.colors.border, true: Theme.colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.settingTitle}>Live Member Presence</Text>
                  <Text style={styles.settingDesc}>Show active presence indicators when collaborators are viewing trips</Text>
                </View>
                <Switch
                  value={notifyLiveActivity}
                  onValueChange={setNotifyLiveActivity}
                  trackColor={{ false: Theme.colors.border, true: Theme.colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </Card>
          </View>
        )}

        {/* TAB 5: ACCOUNT */}
        {activeTab === 'account' && (
          <View style={styles.tabSection}>
            <Text style={styles.sectionHeading}>Account & Data</Text>

            {/* Account Overview Card */}
            <Card style={styles.cardSection}>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Ionicons name="person-circle-outline" size={24} color={Theme.colors.accent} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{displayName}</Text>
                  <Text style={styles.settingDesc}>{email}</Text>
                </View>
              </View>

              <Button
                title="Sign Out"
                variant="outline"
                onPress={handleLogout}
                isLoading={isLoading}
                icon={<Ionicons name="log-out-outline" size={18} color={Theme.colors.textPrimary} />}
                style={{ marginTop: 14 }}
              />
            </Card>

            {/* Danger Zone */}
            <Text style={[styles.sectionHeading, { color: Theme.colors.status.error, marginTop: 24 }]}>
              Danger Zone
            </Text>
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
                    Permanently delete your account, personal data, and owned trips. Requires email OTP verification.
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

            {/* TravelSync Brand & App Info Footer */}
            <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 16 }}>
              <BrandLogo
                size="md"
                subtitle="Mobile Edition • Synchronized with TravelSync Web"
              />
            </View>
          </View>
        )}
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  topHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: Theme.colors.border,
  },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.accentText,
  },
  cameraButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  email: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(134, 169, 139, 0.15)',
    borderColor: 'rgba(134, 169, 139, 0.3)',
  },
  badgeWarning: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  textSuccess: {
    color: Theme.colors.status.success,
  },
  textWarning: {
    color: Theme.colors.status.warning,
  },
  tabNavContainer: {
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  tabNavContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  subTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    gap: 6,
  },
  subTabItemActive: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  subTabItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textMuted,
  },
  subTabItemTextActive: {
    color: Theme.colors.accentText,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  tabSection: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 12,
  },
  cardSection: {
    padding: 16,
  },
  memberSinceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Theme.colors.surfaceElevated,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginTop: 6,
    marginBottom: 16,
  },
  memberSinceLabel: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  memberSinceValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
    marginTop: 1,
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  settingDesc: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  activePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(134, 169, 139, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(134, 169, 139, 0.3)',
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.status.success,
  },
  actionBtnOutline: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surfaceElevated,
  },
  actionBtnOutlineText: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.border,
    marginVertical: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textMuted,
    marginBottom: 8,
  },
  currencyPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  currencyPillActive: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  currencyPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  currencyPillTextActive: {
    color: Theme.colors.accentText,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dangerCard: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.status.error,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  devOtpBanner: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  devOtpTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.status.warning,
  },
  devOtpCode: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.colors.status.warning,
    letterSpacing: 4,
    marginTop: 2,
  },
});
