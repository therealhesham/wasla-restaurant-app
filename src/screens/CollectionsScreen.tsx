import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, tintedShadow } from '../theme';
import { fetchStatement } from '../api';
import type { Order, PendingSettlement, SettlementRecord, StatementEntry } from '../api';

type Props = {
  pending: PendingSettlement | null;
  history: SettlementRecord[];
  orders: Order[];
  refreshing: boolean;
  onRefresh: () => void;
  token: string;
};

const RANGE_OPTIONS = [
  { label: '7 أيام', days: 7 },
  { label: '30 يوم', days: 30 },
  { label: '90 يوم', days: 90 },
];

const STATEMENT_ENTRY_META: Record<string, { icon: keyof typeof Ionicons.glyphMap }> = {
  order_net: { icon: 'receipt-outline' },
  settlement_payment: { icon: 'checkmark-done-outline' },
  service_commission: { icon: 'pricetag-outline' },
};

const DIRECTION_META: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  restaurant_owes: { label: 'مستحق عليك', color: colors.danger, bg: colors.dangerBg, icon: 'arrow-up-circle' },
  admin_owes: { label: 'مستحق لك', color: colors.success, bg: colors.successBg, icon: 'arrow-down-circle' },
  settled: { label: 'مُسوّى', color: colors.subtext, bg: colors.neutralTint, icon: 'checkmark-circle' },
};

const SETTLEMENT_MODE_META: Record<string, { label: string; color: string }> = {
  courier_collects: { label: 'الدفع عند الاستلام', color: colors.primary },
  courier_advances: { label: 'محفظة المندوب', color: colors.accent },
  customer_prepaid: { label: 'مدفوع مسبقًا', color: colors.success },
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownValue}>{value}</Text>
      <Text style={styles.breakdownLabel}>{label}</Text>
    </View>
  );
}

export default function CollectionsScreen({ pending, history, orders, refreshing, onRefresh, token }: Props) {
  const meta = pending ? DIRECTION_META[pending.direction] : DIRECTION_META.settled;
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const [statementVisible, setStatementVisible] = useState(false);
  const [rangeDays, setRangeDays] = useState(30);
  const [statementEntries, setStatementEntries] = useState<StatementEntry[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState('');

  const loadStatement = useCallback(async (days: number) => {
    setStatementLoading(true);
    setStatementError('');
    try {
      const result = await fetchStatement(token, days);
      setStatementEntries(result.entries);
    } catch (err: any) {
      setStatementError(err?.message || 'تعذر تحميل كشف الحساب.');
    } finally {
      setStatementLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (statementVisible) loadStatement(rangeDays);
  }, [statementVisible, rangeDays, loadStatement]);

  const ordersById = useMemo(() => {
    const map = new Map<string, Order>();
    for (const order of orders) map.set(order.id, order);
    return map;
  }, [orders]);

  const settlementModeBreakdown = useMemo(() => {
    if (!pending) return [];
    const counts = new Map<string, number>();
    for (const order of pending.orders) {
      counts.set(order.settlementMode, (counts.get(order.settlementMode) ?? 0) + 1);
    }
    return [...counts.entries()].map(([mode, count]) => ({
      mode,
      count,
      meta: SETTLEMENT_MODE_META[mode] ?? { label: mode, color: colors.subtext },
    }));
  }, [pending]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>التحصيلات</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {pending ? (
          <View style={styles.pendingWrap}>
            <View style={[styles.pendingCard, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon} size={22} color={meta.color} style={{ marginBottom: 4 }} />
              <Text style={[styles.pendingLabel, { color: meta.color }]}>{meta.label}</Text>
              <Text style={[styles.pendingAmount, { color: meta.color }]}>{Math.abs(pending.netAmount)} ر.س</Text>
              <View style={styles.pendingRow}>
                <Text style={styles.pendingStat}>{pending.ordersCount} طلب غير مُسوّى</Text>
                <Text style={styles.pendingStat}>إجمالي الوجبات: {pending.totalMealValue} ر.س</Text>
              </View>
              <View style={styles.pendingRow}>
                <Text style={styles.pendingStat}>مستحق من العميل للمتجر: {pending.mealOwedToRestaurant} ر.س</Text>
                <Text style={styles.pendingStat}>دين رسوم التوصيل: {pending.deliveryFeeDebt} ر.س</Text>
              </View>
            </View>

            {settlementModeBreakdown.length > 0 && (
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>طريقة التحصيل للطلبات المعلّقة</Text>
                {settlementModeBreakdown.map((item) => (
                  <View key={item.mode} style={styles.breakdownBarRow}>
                    <Text style={styles.breakdownBarCount}>{item.count}</Text>
                    <View style={styles.breakdownBarTrack}>
                      <View
                        style={[
                          styles.breakdownBarFill,
                          { width: `${Math.max((item.count / pending.ordersCount) * 100, 8)}%`, backgroundColor: item.meta.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.breakdownBarLabel}>{item.meta.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {pending.orders.length > 0 && (
              <TouchableOpacity style={styles.expandToggle} onPress={() => setPendingExpanded((v) => !v)} activeOpacity={0.7}>
                <Ionicons name={pendingExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} />
                <Text style={styles.expandToggleText}>{pendingExpanded ? 'إخفاء الطلبات المعلّقة' : `عرض الطلبات المعلّقة (${pending.orders.length})`}</Text>
              </TouchableOpacity>
            )}

            {pendingExpanded && (
              <View style={styles.pendingOrdersList}>
                {pending.orders.map((order, index) => {
                  const modeMeta = SETTLEMENT_MODE_META[order.settlementMode] ?? { label: order.settlementMode, color: colors.subtext };
                  return (
                    <View key={order.id} style={[styles.pendingOrderRow, index === pending.orders.length - 1 ? { borderBottomWidth: 0 } : null]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pendingOrderCustomer}>{order.customerName}</Text>
                        <View style={styles.pendingOrderMetaRow}>
                          <Text style={styles.pendingOrderNumber}>{order.orderNumber || order.id}</Text>
                          <Text style={[styles.pendingOrderMode, { color: modeMeta.color }]}>{modeMeta.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.pendingOrderAmount}>{(order.mealAmount + order.deliveryFee).toFixed(0)} ر.س</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        <TouchableOpacity style={styles.statementToggle} onPress={() => setStatementVisible((v) => !v)} activeOpacity={0.8}>
          <Ionicons name={statementVisible ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statementToggleTitle}>كشف الحساب التفصيلي</Text>
            <Text style={styles.statementToggleSubtitle}>سجل زمني كامل بكل حركة على حسابك، برصيد متراكم</Text>
          </View>
          <View style={styles.statementToggleIconWrap}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {statementVisible && (
          <View style={styles.statementWrap}>
            <View style={styles.rangeRow}>
              {RANGE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.days}
                  style={[styles.rangeChip, rangeDays === option.days ? styles.rangeChipActive : null]}
                  onPress={() => setRangeDays(option.days)}
                >
                  <Text style={[styles.rangeChipText, rangeDays === option.days ? styles.rangeChipTextActive : null]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {statementLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : statementError ? (
              <Text style={styles.statementErrorText}>{statementError}</Text>
            ) : statementEntries.length === 0 ? (
              <Text style={styles.statementEmptyText}>لا توجد حركات في هذه الفترة.</Text>
            ) : (
              statementEntries.slice().reverse().map((entry, index) => {
                const entryMeta = STATEMENT_ENTRY_META[entry.type] || { icon: 'ellipse-outline' };
                const isDebt = entry.amount > 0;
                return (
                  <View key={`${entry.orderId ?? 'settlement'}-${entry.type}-${index}`} style={styles.statementCard}>
                    <View style={styles.statementIconWrap}>
                      <Ionicons name={entryMeta.icon} size={15} color={isDebt ? colors.danger : colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statementCardTitle}>{entry.label}{entry.orderNumber ? ` · ${entry.orderNumber}` : ''}</Text>
                      <Text style={styles.statementCardDesc}>{entry.description}</Text>
                      <Text style={styles.statementCardDate}>{formatDateTime(entry.date)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.statementAmount, { color: isDebt ? colors.danger : colors.success }]}>
                        {entry.amount >= 0 ? '+' : '-'}{Math.abs(entry.amount).toFixed(0)} ر.س
                      </Text>
                      <Text style={styles.statementRunning}>الرصيد: {entry.runningBalance.toFixed(0)} ر.س</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>سجل التسويات</Text>
        {history.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="time-outline" size={30} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>لا يوجد سجل تسويات بعد</Text>
            <Text style={styles.emptyBody}>ستظهر هنا كل تسوية مالية تتم بينك وبين إدارة المنصة.</Text>
          </View>
        ) : (
          history.map((record) => {
            const recordMeta = DIRECTION_META[record.direction] ?? DIRECTION_META.settled;
            const isExpanded = expandedRecordId === record.id;
            const resolvedOrders = record.orderIds.map((id) => ordersById.get(id)).filter(Boolean) as Order[];

            return (
              <TouchableOpacity
                key={record.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => setExpandedRecordId((current) => (current === record.id ? null : record.id))}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardDate}>{formatDate(record.createdAt)}</Text>
                  <View style={[styles.badge, { backgroundColor: recordMeta.bg }]}>
                    <Ionicons name={recordMeta.icon} size={12} color={recordMeta.color} />
                    <Text style={[styles.badgeText, { color: recordMeta.color }]}>{recordMeta.label}</Text>
                  </View>
                </View>
                <Text style={styles.cardAmount}>{record.amountSettled} ر.س</Text>
                <Text style={styles.cardMeta}>{record.ordersCount} طلب · إجمالي الوجبات {record.totalMealValue} ر.س</Text>

                {isExpanded && (
                  <View style={styles.cardDetail}>
                    <BreakdownRow label="إجمالي قيمة الوجبات" value={`${record.totalMealValue} ر.س`} />
                    <BreakdownRow label="دين رسوم التوصيل" value={`${record.deliveryFeeDebt} ر.س`} />
                    <BreakdownRow label="رسوم/غرامات مُحصّلة" value={`${record.feesCharged} ر.س`} />
                    <BreakdownRow label="صافي الحساب" value={`${record.netAmount > 0 ? '+' : ''}${record.netAmount} ر.س`} />
                    <BreakdownRow label="المبلغ الذي تمت تسويته" value={`${record.amountSettled} ر.س`} />
                    {record.notes ? <BreakdownRow label="ملاحظات" value={record.notes} /> : null}
                    {record.settledBy ? <BreakdownRow label="بواسطة" value={record.settledBy} /> : null}
                    <BreakdownRow label="وقت التسوية" value={formatDateTime(record.createdAt)} />

                    {resolvedOrders.length > 0 && (
                      <View style={styles.ordersIncludedWrap}>
                        <Text style={styles.ordersIncludedTitle}>الطلبات ضمن هذه التسوية</Text>
                        {resolvedOrders.map((order) => (
                          <View key={order.id} style={styles.ordersIncludedRow}>
                            <Text style={styles.ordersIncludedAmount}>{(order.mealAmount + order.deliveryFee).toFixed(0)} ر.س</Text>
                            <Text style={styles.ordersIncludedText}>{order.customerName} · {order.orderNumber || order.id}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.cardFooter}>
                  {record.notes && !isExpanded ? <Text style={styles.cardNotes} numberOfLines={1}>{record.notes}</Text> : <View />}
                  <View style={styles.expandHint}>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.subtext} />
                    <Text style={styles.expandHintText}>{isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14 },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'right' },
  list: { paddingHorizontal: 20, paddingBottom: 30 },
  emptyWrap: { alignItems: 'center', marginTop: 10, marginBottom: spacing.lg, paddingHorizontal: spacing.lg },
  emptyIconWrap: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontSize: 14, fontWeight: '900', color: colors.text, marginBottom: 4 },
  emptyBody: { fontSize: 12.5, color: colors.subtext, textAlign: 'center', lineHeight: 18 },

  pendingWrap: { marginBottom: 22 },
  pendingCard: { borderRadius: 20, padding: 20, alignItems: 'center' },
  pendingLabel: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  pendingAmount: { fontSize: 34, fontWeight: '900', marginBottom: 14 },
  pendingRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', width: '100%', marginTop: 4 },
  pendingStat: { fontSize: 11, fontWeight: '700', color: colors.subtext },

  breakdownCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm + 2, ...tintedShadow(colors.text, 0.04) },
  breakdownTitle: { fontSize: 12.5, fontWeight: '800', color: colors.text, textAlign: 'right', marginBottom: spacing.sm },
  breakdownBarRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs + 2 },
  breakdownBarCount: { fontSize: 11.5, fontWeight: '900', color: colors.text, width: 16, textAlign: 'center' },
  breakdownBarTrack: { flex: 1, height: 7, borderRadius: radius.pill, backgroundColor: colors.neutralTint, overflow: 'hidden' },
  breakdownBarFill: { height: 7, borderRadius: radius.pill },
  breakdownBarLabel: { fontSize: 10.5, fontWeight: '700', color: colors.textSoft, width: 88, textAlign: 'right' },

  expandToggle: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing.sm + 2, paddingVertical: 8 },
  expandToggleText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  pendingOrdersList: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm + 2, ...tintedShadow(colors.text, 0.04) },
  pendingOrderRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.neutralTint },
  pendingOrderCustomer: { fontSize: 12.5, fontWeight: '800', color: colors.text, textAlign: 'right' },
  pendingOrderMetaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 2 },
  pendingOrderNumber: { fontSize: 10.5, fontWeight: '600', color: colors.subtext },
  pendingOrderMode: { fontSize: 10.5, fontWeight: '800' },
  pendingOrderAmount: { fontSize: 12.5, fontWeight: '900', color: colors.primary },

  statementToggle: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...tintedShadow(colors.text, 0.04) },
  statementToggleIconWrap: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  statementToggleTitle: { fontSize: 13.5, fontWeight: '900', color: colors.text, textAlign: 'right' },
  statementToggleSubtitle: { fontSize: 11, fontWeight: '700', color: colors.subtext, textAlign: 'right', marginTop: 2 },

  statementWrap: { marginBottom: spacing.md },
  rangeRow: { flexDirection: 'row-reverse', gap: spacing.sm, marginBottom: spacing.md },
  rangeChip: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  rangeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeChipText: { fontSize: 12, fontWeight: '800', color: colors.subtext },
  rangeChipTextActive: { color: '#fff' },
  statementErrorText: { color: colors.danger, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  statementEmptyText: { color: colors.subtext, fontWeight: '700', textAlign: 'center', marginTop: 12, fontSize: 12.5 },
  statementCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 10, ...tintedShadow(colors.text, 0.05) },
  statementIconWrap: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.neutralTint, alignItems: 'center', justifyContent: 'center' },
  statementCardTitle: { fontSize: 12.5, fontWeight: '800', color: colors.text, textAlign: 'right' },
  statementCardDesc: { fontSize: 11, fontWeight: '600', color: colors.subtext, textAlign: 'right', marginTop: 2 },
  statementCardDate: { fontSize: 10, fontWeight: '600', color: colors.subtext, textAlign: 'right', marginTop: 2 },
  statementAmount: { fontSize: 13, fontWeight: '900' },
  statementRunning: { fontSize: 9.5, fontWeight: '700', color: colors.subtext, marginTop: 2 },

  sectionTitle: { fontSize: 15, fontWeight: '900', color: colors.text, textAlign: 'right', marginBottom: 12 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, ...tintedShadow(colors.text, 0.05) },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardDate: { color: colors.subtext, fontSize: 11, fontWeight: '700' },
  badge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  cardAmount: { fontWeight: '900', color: colors.text, fontSize: 18, textAlign: 'right', marginBottom: 4 },
  cardMeta: { color: colors.subtext, fontSize: 12, fontWeight: '700', textAlign: 'right', marginBottom: 4 },
  cardNotes: { color: colors.text, fontSize: 11.5, fontWeight: '600', textAlign: 'right', flexShrink: 1 },

  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  expandHint: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  expandHintText: { fontSize: 10.5, fontWeight: '700', color: colors.subtext },

  cardDetail: { marginTop: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.neutralTint, paddingTop: spacing.sm + 2 },
  breakdownRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  breakdownValue: { fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'left', flexShrink: 1, marginLeft: spacing.sm },
  breakdownLabel: { fontSize: 12, fontWeight: '700', color: colors.subtext },

  ordersIncludedWrap: { marginTop: spacing.sm, backgroundColor: colors.neutralTint, borderRadius: radius.md, padding: spacing.sm },
  ordersIncludedTitle: { fontSize: 11, fontWeight: '800', color: colors.text, textAlign: 'right', marginBottom: 6 },
  ordersIncludedRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  ordersIncludedText: { fontSize: 11, fontWeight: '700', color: colors.textSoft },
  ordersIncludedAmount: { fontSize: 11, fontWeight: '900', color: colors.primary },
});
