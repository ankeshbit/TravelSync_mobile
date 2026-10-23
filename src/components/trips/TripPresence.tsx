import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';
import { ActiveMember } from '@/hooks/useTripSocket';

interface TripPresenceProps {
  activeMembers: ActiveMember[];
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function TripPresence({ activeMembers }: TripPresenceProps) {
  if (!activeMembers || activeMembers.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.liveIndicator}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>Live</Text>
      </View>

      <View style={styles.avatarStack}>
        {activeMembers.slice(0, 4).map((member) => (
          <View key={member.userId} style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(member.name)}</Text>
          </View>
        ))}
        {activeMembers.length > 4 && (
          <View style={[styles.avatar, styles.overflowAvatar]}>
            <Text style={styles.overflowText}>+{activeMembers.length - 4}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Theme.colors.status.success,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.status.success,
    letterSpacing: 0.3,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22231F',
    borderWidth: 1.5,
    borderColor: Theme.colors.status.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#D5D3CA',
  },
  overflowAvatar: {
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border,
  },
  overflowText: {
    fontSize: 9,
    fontWeight: '700',
    color: Theme.colors.textMuted,
  },
});
