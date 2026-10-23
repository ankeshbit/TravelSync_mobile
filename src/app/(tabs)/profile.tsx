import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { getApiBaseUrl } from '@/config/env';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Theme } from '@/constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, firebaseUser, logout, syncBackendUser, isLoading } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const updated = await syncBackendUser();
      if (updated) {
        Alert.alert('Synced', 'Successfully synchronized user profile with TravelSync PostgreSQL database.');
      } else {
        Alert.alert('Notice', 'Could not sync with PostgreSQL backend. Verify server is running.');
      }
    } finally {
      setIsSyncing(false);
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

  const displayName = user?.name || firebaseUser?.displayName || 'Traveler';
  const email = user?.email || firebaseUser?.email || 'N/A';
  const isEmailVerified = firebaseUser?.emailVerified === true;
  const isDbSynced = Boolean(user?.id);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Avatar & Info Card */}
      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{email}</Text>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, isEmailVerified ? styles.badgeSuccess : styles.badgeWarning]}>
            <Ionicons
              name={isEmailVerified ? 'checkmark-circle' : 'alert-circle'}
              size={14}
              color={isEmailVerified ? Theme.colors.status.success : Theme.colors.status.warning}
            />
            <Text style={[styles.badgeText, isEmailVerified ? styles.textSuccess : styles.textWarning]}>
              {isEmailVerified ? 'Email Verified' : 'Email Unverified'}
            </Text>
          </View>

          <View style={[styles.badge, isDbSynced ? styles.badgeSuccess : styles.badgeWarning]}>
            <Ionicons
              name={isDbSynced ? 'server' : 'cloud-offline'}
              size={14}
              color={isDbSynced ? Theme.colors.status.success : Theme.colors.status.warning}
            />
            <Text style={[styles.badgeText, isDbSynced ? styles.textSuccess : styles.textWarning]}>
              {isDbSynced ? 'Postgres Synced' : 'Sync Pending'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Backend & Environment Status */}
      <Text style={styles.sectionTitle}>Backend Architecture</Text>
      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>API Base URL</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{getApiBaseUrl()}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>PostgreSQL User ID</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{user?.id || 'Auto-provisions on verified login'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Firebase UID</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{firebaseUser?.uid || 'Not available'}</Text>
        </View>

        <Button
          title="Refresh Backend Sync"
          variant="outline"
          onPress={handleSync}
          isLoading={isSyncing}
          style={styles.syncButton}
        />
      </Card>

      {/* Account Actions */}
      <View style={styles.actions}>
        <Button
          title="Sign Out"
          variant="danger"
          onPress={handleLogout}
          isLoading={isLoading}
        />
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
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.accentText,
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
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 10,
    marginLeft: 4,
  },
  infoCard: {
    marginBottom: 24,
  },
  infoRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  infoLabel: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: Theme.colors.textPrimary,
    fontWeight: '600',
  },
  syncButton: {
    marginTop: 16,
  },
  actions: {
    marginTop: 8,
  },
});
