import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, tintedShadow, getStatusMeta } from '../theme';
import type { Order } from '../api';

type Props = {
  orders: Order[];
  refreshing: boolean;
  onRefresh: () => void;
  onBack?: () => void;
  onOpenOrder: (order: Order) => void;
  onMarkReady: (orderId: string) => void;
  onCreateOrder?: () => void;
};

const TERMINAL = ['delivered', 'closed', 'cancelled', 'deliveryFailed', 'returned'];
const CANCELLED_LIKE = ['cancelled', 'deliveryFailed', 'returned'];
const COMPLETED_LIKE = ['delivered', 'closed'];

type FilterKey = 'all' | 'active' | 'completed' | 'cancelled';

const FILTERS: { key: FilterKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'الكل', icon: 'apps-outline' },
  { key: 'active', label: 'نشطة', icon: 'flash-outline' },
  { key: 'completed', label: 'مكتملة', icon: 'checkmark-done-outline' },
  { key: 'cancelled', label: 'ملغاة', icon: 'close-circle-outline' },
];

function matchesFilter(status: string, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'active') return !TERMINAL.includes(status);
  if (filter === 'completed') return COMPLETED_LIKE.includes(status);
  return CANCELLED_LIKE.includes(status);
}

type DateFilterKey = 'all' | 'today' | 'yesterday' | 'week' | 'month';

const DATE_FILTERS: { key: DateFilterKey; label: string }[] = [
  { key: 'all', label: 'كل الوقت' },
  { key: 'today', label: 'اليوم' },
  { key: 'yesterday', label: 'أمس' },
  { key: 'week', label: 'هذا الأسبوع' },
  { key: 'month', label: 'هذا الشهر' },
];

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function matchesDateFilter(createdAt: string, filter: DateFilterKey) {
  if (filter === 'all') return true;
  const created = new Date(createdAt);
  const now = new Date();
  const todayStart = startOfDay(now);

  if (filter === 'today') return created >= todayStart;

  if (filter === 'yesterday') {
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    return created >= yesterdayStart && created < todayStart;
  }

  if (filter === 'week') {
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return created >= weekStart;
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return created >= monthStart;
}

export default function OrdersListScreen({ orders, refreshing, onRefresh, onBack, onOpenOrder, onMarkReady, onCreateOrder }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('all');

  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = { all: orders.length, active: 0, completed: 0, cancelled: 0 };
    for (const order of orders) {
      if (matchesFilter(order.status, 'active')) counts.active += 1;
      if (matchesFilter(order.status, 'completed')) counts.completed += 1;
      if (matchesFilter(order.status, 'cancelled')) counts.cancelled += 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (!matchesFilter(order.status, filter)) return false;
      if (!matchesDateFilter(order.createdAt, dateFilter)) return false;
      if (!q) return true;
      return order.customerName.toLowerCase().includes(q) || order.phone.toLowerCase().includes(q) || (order.orderNumber ?? order.id).toLowerCase().includes(q);
    });
  }, [orders, query, filter, dateFilter]);

  const hasActiveFilters = Boolean(query) || filter !== 'all' || dateFilter !== 'all';

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={16} color={colors.primary} />
            <Text style={styles.backText}>رجوع</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
        <Text style={styles.title}>الطلبات</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={17} color={colors.subtext} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث بالاسم أو رقم الجوال..."
          placeholderTextColor={colors.muted}
          textAlign="right"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={17} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}
              onPress={() => setFilter(item.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={item.icon} size={13} color={active ? '#fff' : colors.subtext} />
              <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                {item.label} · {filterCounts[item.key]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.filterRow}>
        {DATE_FILTERS.map((item) => {
          const active = item.key === dateFilter;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.dateChip, active ? styles.dateChipActive : null]}
              onPress={() => setDateFilter(item.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.dateChipText, active ? styles.dateChipTextActive : null]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name={hasActiveFilters ? 'search-outline' : 'receipt-outline'} size={34} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{hasActiveFilters ? 'لا توجد نتائج مطابقة' : 'لا توجد طلبات بعد'}</Text>
            <Text style={styles.emptyBody}>
              {hasActiveFilters
                ? 'جرّب كلمة بحث أخرى أو غيّر الفلاتر المحددة.'
                : 'أول طلب تنشئه سيظهر هنا مباشرة، جاهزًا للمتابعة خطوة بخطوة.'}
            </Text>
            {onCreateOrder && !hasActiveFilters ? (
              <TouchableOpacity style={styles.emptyCta} onPress={onCreateOrder} activeOpacity={0.85}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.emptyCtaText}>إنشاء أول طلب</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const meta = getStatusMeta(item.status);
          return (
            <TouchableOpacity style={styles.card} onPress={() => onOpenOrder(item)} activeOpacity={0.8}>
              <View style={styles.cardTop}>
                <Text style={styles.orderNumber}>{item.orderNumber || item.id}</Text>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon as any} size={12} color={meta.color} />
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>

              <View style={styles.customerRow}>
                <Ionicons name="person-outline" size={13} color={colors.subtext} />
                <Text style={styles.customer}>{item.customerName} • {item.phone}</Text>
              </View>
              <View style={styles.customerRow}>
                <Ionicons name="location-outline" size={13} color={colors.subtext} />
                <Text style={styles.address} numberOfLines={1}>{item.area} — {item.address}</Text>
              </View>

              <View style={styles.cardBottom}>
                <Text style={styles.amount}>{(item.mealAmount + item.deliveryFee).toFixed(0)} ر.س</Text>
                <View style={styles.courierRow}>
                  <Ionicons name={item.courierName ? 'bicycle-outline' : 'time-outline'} size={13} color={colors.subtext} />
                  <Text style={styles.courier}>{item.courierName || 'بانتظار إسناد سائق'}</Text>
                </View>
              </View>

              {item.status === 'preparing' && (
                <TouchableOpacity
                  style={styles.quickReady}
                  onPress={(event) => {
                    event.stopPropagation();
                    onMarkReady(item.id);
                  }}
                >
                  <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                  <Text style={styles.quickReadyText}>تم التجهيز — جاهز للاستلام</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: spacing.sm },
  backButton: { flexDirection: 'row-reverse', alignItems: 'center', width: 60 },
  backText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  title: { fontSize: 18, fontWeight: '900', color: colors.text },
  searchBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    marginHorizontal: 20,
    marginBottom: spacing.sm + spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  filterRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: spacing.xs + 2,
    paddingBottom: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '800', color: colors.subtext },
  filterChipTextActive: { color: '#fff' },
  dateChip: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dateChipText: { fontSize: 11.5, fontWeight: '800', color: colors.subtext },
  dateChipTextActive: { color: '#fff' },
  list: { paddingHorizontal: 20, paddingBottom: 30, paddingTop: spacing.xs },
  emptyWrap: { alignItems: 'center', marginTop: 50, paddingHorizontal: spacing.lg },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: spacing.xs },
  emptyBody: { fontSize: 13, color: colors.subtext, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  emptyCta: { flexDirection: 'row-reverse', gap: 6, backgroundColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + spacing.xs, ...tintedShadow(colors.primary, 0.28) },
  emptyCtaText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 12, ...tintedShadow(colors.text, 0.05) },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  orderNumber: { fontWeight: '900', color: colors.text, fontSize: 14 },
  badge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  customerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 5 },
  customer: { color: colors.text, fontWeight: '700', fontSize: 13, textAlign: 'right', flexShrink: 1 },
  address: { color: colors.subtext, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  cardBottom: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  amount: { fontWeight: '900', color: colors.primary, fontSize: 14 },
  courierRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  courier: { color: colors.subtext, fontSize: 11, fontWeight: '700' },
  quickReady: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, backgroundColor: colors.successBg, borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.successBorder },
  quickReadyText: { color: colors.success, fontWeight: '800', fontSize: 12 },
});
