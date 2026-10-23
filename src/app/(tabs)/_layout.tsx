import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { Theme } from '@/constants/theme';

import { BrandLogo } from '@/components/common/BrandLogo';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Theme.colors.surfaceElevated },
        headerTitleStyle: { fontWeight: '700', color: Theme.colors.textPrimary, fontSize: 18 },
        headerShadowVisible: false,
        tabBarActiveTintColor: Theme.colors.accent,
        tabBarInactiveTintColor: Theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: Theme.colors.surface,
          borderTopColor: Theme.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trips',
          headerTitle: () => <BrandLogo size="sm" />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="airplane-outline" size={size} color={color ? String(color) : Theme.colors.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          headerTitle: 'Explore Destinations',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color ? String(color) : Theme.colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'Account Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color ? String(color) : Theme.colors.textMuted} />
          ),
        }}
      />
    </Tabs>
  );
}
