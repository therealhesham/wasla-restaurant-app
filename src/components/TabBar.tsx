import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';

export type TabKey = 'home' | 'orders' | 'violations' | 'collections';

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home', label: 'الرئيسية', icon: 'home-outline', iconActive: 'home' },
  { key: 'orders', label: 'الطلبات', icon: 'cube-outline', iconActive: 'cube' },
  { key: 'violations', label: 'المخالفات', icon: 'warning-outline', iconActive: 'warning' },
  { key: 'collections', label: 'التحصيلات', icon: 'wallet-outline', iconActive: 'wallet' },
];

type Props = {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  badges?: Partial<Record<TabKey, number>>;
};

export default function TabBar({ active, onChange, badges }: Props) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const badge = badges?.[tab.key];
        return (
          <TouchableOpacity key={tab.key} style={styles.item} onPress={() => onChange(tab.key)} activeOpacity={0.7}>
            <View style={[styles.iconWrap, isActive ? styles.iconWrapActive : null]}>
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={19}
                color={isActive ? colors.primary : colors.subtext}
              />
              {badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, isActive ? styles.labelActive : null]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: 26,
  },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.primaryTint },
  label: { fontSize: 10.5, fontWeight: '700', color: colors.subtext },
  labelActive: { color: colors.primary, fontWeight: '900' },
  badge: {
    position: 'absolute',
    top: -2,
    left: 2,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});
