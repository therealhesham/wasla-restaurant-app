import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, getStatusMeta, radius, spacing, tintedShadow } from '../theme';
import type { Order, PendingSettlement, Restaurant } from '../api';
import type { TabKey } from '../components/TabBar';

type Props = {
  restaurant: Restaurant;
  orders: Order[];
  pendingSettlement: PendingSettlement | null;
  onCreateOrder: () => void;
  onNavigate: (tab: TabKey) => void;
  onOpenProfile: () => void;
  onOpenOrder: (order: Order) => void;
  onLogout: () => void;
};

const TERMINAL = ['delivered', 'closed', 'cancelled', 'deliveryFailed', 'returned'];
const WEEKDAY_LABELS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(dateString: string) {
  return isSameDay(new Date(dateString), new Date());
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 17) return 'مساء الخير مبكرًا';
  return 'مساء الخير';
}

const STAT_META = [
  { key: 'todayCount', icon: 'receipt-outline', label: 'طلبات اليوم' },
  { key: 'todayCollected', icon: 'cash-outline', label: 'تحصيل اليوم' },
  { key: 'activeCount', icon: 'flash-outline', label: 'طلبات نشطة' },
  { key: 'totalCount', icon: 'archive-outline', label: 'كل الطلبات' },
] as const;

const SHORTCUTS: { tab: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }[] = [
  { tab: 'orders', label: 'الطلبات', icon: 'cube-outline', color: colors.accent, bg: colors.accentTint },
  { tab: 'violations', label: 'المخالفات', icon: 'warning-outline', color: colors.warning, bg: colors.warningBg },
  { tab: 'collections', label: 'التحصيلات', icon: 'wallet-outline', color: colors.success, bg: colors.successBg },
];

export default function HomeScreen({ restaurant, orders, pendingSettlement, onCreateOrder, onNavigate, onOpenProfile, onOpenOrder, onLogout }: Props) {
  const stats = useMemo(() => {
    const todayOrders = orders.filter((order) => isToday(order.createdAt));
    const todayCollected = todayOrders.reduce((sum, order) => sum + (order.collectedAmount || 0), 0);
    const activeOrders = orders.filter((order) => !TERMINAL.includes(order.status));
    return { todayCount: todayOrders.length, todayCollected, activeCount: activeOrders.length, totalCount: orders.length };
  }, [orders]);

  const statusBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of orders) {
      counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
    }
    const maxCount = Math.max(1, ...counts.values());
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({ status, count, meta: getStatusMeta(status), ratio: count / maxCount }));
  }, [orders]);

  const weeklyChart = useMemo(() => {
    const days: { date: Date; label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({ date, label: WEEKDAY_LABELS[date.getDay()], count: 0 });
    }
    for (const order of orders) {
      const created = new Date(order.createdAt);
      const day = days.find((d) => isSameDay(d.date, created));
      if (day) day.count += 1;
    }
    const maxCount = Math.max(1, ...days.map((d) => d.count));
    return days.map((d) => ({ ...d, ratio: d.count / maxCount }));
  }, [orders]);

  const recentOrders = useMemo(() => [...orders].slice(0, 4), [orders]);

  const violationsCount = (restaurant.recurringFees ?? []).filter((fee) => fee.isActive).length;
  const netAmount = pendingSettlement?.netAmount ?? 0;
  const settlementDirection = pendingSettlement?.direction ?? 'settled';

  const statValues: Record<(typeof STAT_META)[number]['key'], string> = {
    todayCount: String(stats.todayCount),
    todayCollected: `${stats.todayCollected.toFixed(0)} ر.س`,
    activeCount: String(stats.activeCount),
    totalCount: String(stats.totalCount),
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greetingForNow()} 👋</Text>
          <View style={styles.nameRow}>
            <TouchableOpacity style={styles.profileButton} onPress={onOpenProfile} activeOpacity={0.75}>
              <Ionicons name="storefront" size={18} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.name}>{restaurant.name}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {restaurant.complianceSuspended ? (
        <View style={styles.suspendedBanner}>
          <View style={styles.suspendedHeader}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.suspendedTitle}>المتجر متوقف مؤقتًا</Text>
          </View>
          <Text style={styles.suspendedBody}>{restaurant.complianceSuspensionReason || 'يوجد مستند إلزامي ناقص أو منتهي. يرجى التواصل مع إدارة المنصة.'}</Text>
        </View>
      ) : null}

      <View style={styles.statsGrid}>
        {STAT_META.map((stat) => (
          <View key={stat.key} style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Ionicons name={stat.icon} size={16} color={colors.primary} />
            </View>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {statValues[stat.key]}
            </Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, restaurant.complianceSuspended ? styles.disabledButton : null]}
        onPress={onCreateOrder}
        disabled={Boolean(restaurant.complianceSuspended)}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={styles.primaryButtonText}>طلب جديد</Text>
      </TouchableOpacity>

      <View style={styles.shortcutsRow}>
        {SHORTCUTS.map((shortcut) => (
          <TouchableOpacity
            key={shortcut.tab}
            style={styles.shortcutCard}
            onPress={() => onNavigate(shortcut.tab)}
            activeOpacity={0.75}
          >
            <View style={[styles.shortcutIconWrap, { backgroundColor: shortcut.bg }]}>
              <Ionicons name={shortcut.icon} size={19} color={shortcut.color} />
            </View>
            <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.financeRow}>
        <TouchableOpacity style={styles.financeCard} onPress={() => onNavigate('collections')} activeOpacity={0.8}>
          <View style={styles.financeTop}>
            <Ionicons
              name={settlementDirection === 'restaurant_owes' ? 'arrow-up-circle' : settlementDirection === 'admin_owes' ? 'arrow-down-circle' : 'checkmark-circle'}
              size={17}
              color={settlementDirection === 'restaurant_owes' ? colors.danger : colors.success}
            />
            <Text style={styles.financeLabel}>الرصيد المعلّق</Text>
          </View>
          <Text style={[styles.financeValue, { color: settlementDirection === 'restaurant_owes' ? colors.danger : colors.success }]}>
            {Math.abs(netAmount).toFixed(0)} ر.س
          </Text>
          <Text style={styles.financeHint}>
            {settlementDirection === 'restaurant_owes' ? 'مستحق عليك' : settlementDirection === 'admin_owes' ? 'مستحق لك' : 'كل شيء مُسوّى'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.financeCard} onPress={() => onNavigate('violations')} activeOpacity={0.8}>
          <View style={styles.financeTop}>
            <Ionicons name="warning" size={17} color={colors.warning} />
            <Text style={styles.financeLabel}>مخالفات نشطة</Text>
          </View>
          <Text style={[styles.financeValue, { color: colors.warning }]}>{violationsCount}</Text>
          <Text style={styles.financeHint}>{violationsCount > 0 ? 'تحتاج مراجعة' : 'لا شيء حاليًا'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>أداء آخر 7 أيام</Text>
        <View style={styles.chartRow}>
          {weeklyChart.map((day) => (
            <View key={day.date.toISOString()} style={styles.chartCol}>
              <Text style={styles.chartCount}>{day.count}</Text>
              <View style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBarFill,
                    { height: `${Math.max(day.ratio * 100, day.count > 0 ? 12 : 3)}%` },
                    isSameDay(day.date, new Date()) ? styles.chartBarFillToday : null,
                  ]}
                />
              </View>
              <Text style={styles.chartLabel}>{day.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {statusBreakdown.length > 0 && (
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownHeader}>
            <TouchableOpacity onPress={() => onNavigate('orders')}>
              <Text style={styles.breakdownSeeAll}>عرض الكل</Text>
            </TouchableOpacity>
            <Text style={styles.breakdownTitle}>توزيع حالات الطلبات</Text>
          </View>

          {statusBreakdown.map((row) => (
            <View key={row.status} style={styles.breakdownRow}>
              <View style={styles.breakdownIconWrap}>
                <Ionicons name={row.meta.icon as any} size={15} color={row.meta.color} />
              </View>
              <View style={styles.breakdownBarTrack}>
                <View style={[styles.breakdownBarFill, { width: `${Math.max(row.ratio * 100, 8)}%`, backgroundColor: row.meta.color }]} />
              </View>
              <Text style={styles.breakdownCount}>{row.count}</Text>
              <Text style={styles.breakdownLabel}>{row.meta.label}</Text>
            </View>
          ))}
        </View>
      )}

      {recentOrders.length > 0 && (
        <View style={styles.recentCard}>
          <View style={styles.breakdownHeader}>
            <TouchableOpacity onPress={() => onNavigate('orders')}>
              <Text style={styles.breakdownSeeAll}>عرض الكل</Text>
            </TouchableOpacity>
            <Text style={styles.breakdownTitle}>أحدث الطلبات</Text>
          </View>

          {recentOrders.map((order, index) => {
            const meta = getStatusMeta(order.status);
            return (
              <TouchableOpacity
                key={order.id}
                style={[styles.recentRow, index === recentOrders.length - 1 ? { borderBottomWidth: 0 } : null]}
                onPress={() => onOpenOrder(order)}
                activeOpacity={0.7}
              >
                <View style={[styles.recentStatusDot, { backgroundColor: meta.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentCustomer}>{order.customerName}</Text>
                  <Text style={styles.recentMeta}>{order.orderNumber || order.id} · {meta.label}</Text>
                </View>
                <Text style={styles.recentAmount}>{(order.mealAmount + order.deliveryFee).toFixed(0)} ر.س</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingTop: 60, paddingBottom: spacing.xl },
  header: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { fontSize: 13, color: colors.subtext, textAlign: 'right', fontWeight: '600' },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs + 2, marginTop: 2 },
  name: { fontSize: 25, fontWeight: '900', color: colors.text, textAlign: 'right' },
  profileButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suspendedBanner: { backgroundColor: colors.dangerBg, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.dangerBorder },
  suspendedHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  suspendedTitle: { color: colors.danger, fontWeight: '900', fontSize: 15, textAlign: 'right' },
  suspendedBody: { color: colors.danger, fontSize: 13, textAlign: 'right', lineHeight: 20, opacity: 0.85 },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    width: '47.5%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    ...tintedShadow(colors.text, 0.06),
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: { fontSize: 19, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 10.5, color: colors.subtext, marginTop: 4, fontWeight: '700' },
  primaryButton: {
    flexDirection: 'row-reverse',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...tintedShadow(colors.primary, 0.3),
  },
  disabledButton: { backgroundColor: colors.muted, shadowOpacity: 0 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  shortcutsRow: { flexDirection: 'row-reverse', gap: spacing.sm, marginBottom: spacing.md },
  shortcutCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  shortcutLabel: { fontSize: 11.5, fontWeight: '800', color: colors.text },

  financeRow: { flexDirection: 'row-reverse', gap: spacing.sm, marginBottom: spacing.md },
  financeCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm + spacing.xs, ...tintedShadow(colors.text, 0.05) },
  financeTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginBottom: 6 },
  financeLabel: { fontSize: 11, fontWeight: '800', color: colors.subtext },
  financeValue: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  financeHint: { fontSize: 10.5, fontWeight: '700', color: colors.muted, marginTop: 2, textAlign: 'right' },

  chartCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...tintedShadow(colors.text, 0.05) },
  chartTitle: { fontSize: 14, fontWeight: '900', color: colors.text, textAlign: 'right', marginBottom: spacing.md },
  chartRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', justifyContent: 'space-between', height: 100 },
  chartCol: { alignItems: 'center', flex: 1 },
  chartCount: { fontSize: 10.5, fontWeight: '800', color: colors.textSoft, marginBottom: 4 },
  chartBarTrack: { width: 16, height: 56, borderRadius: radius.pill, backgroundColor: colors.neutralTint, justifyContent: 'flex-end', overflow: 'hidden' },
  chartBarFill: { width: '100%', borderRadius: radius.pill, backgroundColor: colors.accent },
  chartBarFillToday: { backgroundColor: colors.primary },
  chartLabel: { fontSize: 10, fontWeight: '700', color: colors.muted, marginTop: 6 },

  breakdownCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...tintedShadow(colors.text, 0.05) },
  breakdownHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm + spacing.xs },
  breakdownTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  breakdownSeeAll: { fontSize: 12, fontWeight: '700', color: colors.primary },
  breakdownRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  breakdownIconWrap: { width: 26, alignItems: 'center' },
  breakdownBarTrack: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.neutralTint, overflow: 'hidden' },
  breakdownBarFill: { height: 8, borderRadius: radius.pill },
  breakdownCount: { fontSize: 12.5, fontWeight: '900', color: colors.text, width: 20, textAlign: 'center' },
  breakdownLabel: { fontSize: 12, fontWeight: '700', color: colors.textSoft, width: 92, textAlign: 'right' },

  recentCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...tintedShadow(colors.text, 0.05) },
  recentRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.neutralTint },
  recentStatusDot: { width: 8, height: 8, borderRadius: radius.pill },
  recentCustomer: { fontSize: 13, fontWeight: '800', color: colors.text, textAlign: 'right' },
  recentMeta: { fontSize: 11, fontWeight: '600', color: colors.subtext, textAlign: 'right', marginTop: 2 },
  recentAmount: { fontSize: 13, fontWeight: '900', color: colors.primary },
});
