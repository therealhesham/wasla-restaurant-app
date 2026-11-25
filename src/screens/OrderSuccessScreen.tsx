import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { colors, radius, spacing, tintedShadow } from '../theme';
import type { Order } from '../api';

type Props = {
  order: Order;
  onViewOrder: () => void;
  onCreateAnother: () => void;
  onDone: () => void;
};

export default function OrderSuccessScreen({ order, onViewOrder, onCreateAnother, onDone }: Props) {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.center}>
        <View style={styles.glow}>
          <View style={styles.badgeCircle}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
        </View>

        <Text style={styles.title}>تم إنشاء الطلب بنجاح 🎉</Text>
        <Text style={styles.orderNumber}>{order.orderNumber || order.id}</Text>
        <Text style={styles.subtitle}>سيتم إسناده لأقرب سائق متاح خلال لحظات.</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryValue}>{order.customerName}</Text>
            <Text style={styles.summaryLabel}>العميل</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryValue}>{(order.mealAmount + order.deliveryFee).toFixed(0)} ر.س</Text>
            <Text style={styles.summaryLabel}>الإجمالي</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={onViewOrder} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>عرض الطلب</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onCreateAnother} activeOpacity={0.7}>
          <Text style={styles.secondaryButtonText}>+ طلب آخر</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDone}>
          <Text style={styles.doneText}>العودة للرئيسية</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  glow: {
    width: 128,
    height: 128,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...tintedShadow(colors.success, 0.35),
  },
  badgeCircle: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 42, fontWeight: '900' },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
  orderNumber: { fontSize: 15, fontWeight: '800', color: colors.primary, marginBottom: spacing.sm, fontVariant: ['tabular-nums'] },
  subtitle: { fontSize: 13, color: colors.subtext, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 20 },
  summaryCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...tintedShadow(colors.text, 0.05),
  },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  summaryLabel: { color: colors.subtext, fontSize: 12, fontWeight: '700' },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: '900' },
  actions: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 17, alignItems: 'center', ...tintedShadow(colors.primary, 0.3) },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  secondaryButton: { backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  doneText: { color: colors.subtext, fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: spacing.xs },
});
