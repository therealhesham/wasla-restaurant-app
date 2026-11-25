import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, tintedShadow } from '../theme';
import { fetchAnalytics } from '../api';
import type { RestaurantAnalytics } from '../api';

type Props = {
  token: string;
  onBack: () => void;
};

const RANGE_OPTIONS = [
  { label: '7 أيام', days: 7 },
  { label: '30 يوم', days: 30 },
  { label: '90 يوم', days: 90 },
];

const CHART_HEIGHT = 120;

function formatHourLabel(hour: number) {
  const period = hour < 12 ? 'ص' : 'م';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period}`;
}

export default function AnalyticsScreen({ token, onBack }: Props) {
  const [rangeDays, setRangeDays] = useState(30);
  const [analytics, setAnalytics] = useState<RestaurantAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (days: number, isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const result = await fetchAnalytics(token, days);
      setAnalytics(result);
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل بيانات التحليلات.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load(rangeDays);
  }, [rangeDays, load]);

  const maxHourlyCount = analytics ? Math.max(1, ...analytics.hourlyOrderCounts) : 1;
  const prepDiffMinutes = analytics ? Number((analytics.avgActualPrepMinutes - analytics.avgPromisedPrepMinutes).toFixed(1)) : 0;
  const isOverPromise = prepDiffMinutes > 0;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>تحليلات الأداء</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.days}
            style={[styles.rangeChip, rangeDays === option.days && styles.rangeChipActive]}
            onPress={() => setRangeDays(option.days)}
          >
            <Text style={[styles.rangeChipText, rangeDays === option.days && styles.rangeChipTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !analytics ? null : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(rangeDays, true)} />}
        >
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{analytics.totalOrders}</Text>
              <Text style={styles.statLabel}>إجمالي الطلبات</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: analytics.onTimeRate >= 80 ? colors.success : colors.warning }]}>
                {analytics.onTimeRate}%
              </Text>
              <Text style={styles.statLabel}>نسبة الالتزام بالوعد</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{analytics.closedOrders}</Text>
              <Text style={styles.statLabel}>طلبات مكتملة</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: analytics.cancelledOrders > 0 ? colors.danger : colors.text }]}>
                {analytics.cancelledOrders}
              </Text>
              <Text style={styles.statLabel}>طلبات ملغاة</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>وقت التجهيز الفعلي مقابل الموعود</Text>
            {analytics.prepSamplesCount === 0 ? (
              <Text style={styles.emptyNote}>لا توجد بيانات كافية بعد (يحتاج طلبات مؤكدة "جاهزة للاستلام").</Text>
            ) : (
              <>
                <View style={styles.prepRow}>
                  <View style={styles.prepBlock}>
                    <Text style={styles.prepValue}>{analytics.avgPromisedPrepMinutes} د</Text>
                    <Text style={styles.prepLabel}>الوقت الموعود</Text>
                  </View>
                  <Ionicons name="arrow-back" size={18} color={colors.subtext} />
                  <View style={styles.prepBlock}>
                    <Text style={[styles.prepValue, { color: isOverPromise ? colors.danger : colors.success }]}>
                      {analytics.avgActualPrepMinutes} د
                    </Text>
                    <Text style={styles.prepLabel}>الوقت الفعلي</Text>
                  </View>
                </View>
                <View style={[styles.prepBanner, isOverPromise ? styles.prepBannerBad : styles.prepBannerGood]}>
                  <Ionicons
                    name={isOverPromise ? 'alert-circle' : 'checkmark-circle'}
                    size={16}
                    color={isOverPromise ? colors.danger : colors.success}
                  />
                  <Text style={[styles.prepBannerText, { color: isOverPromise ? colors.danger : colors.success }]}>
                    {isOverPromise
                      ? `أبطأ من الوعد بمعدل ${Math.abs(prepDiffMinutes)} دقيقة`
                      : `أسرع من أو مطابق للوعد بمعدل ${Math.abs(prepDiffMinutes)} دقيقة`}
                  </Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>ساعات الذروة (عدد الطلبات حسب الساعة)</Text>
            {analytics.totalOrders === 0 ? (
              <Text style={styles.emptyNote}>لا توجد طلبات كافية بعد لعرض التوزيع.</Text>
            ) : (
              <View style={styles.chartWrap}>
                {analytics.hourlyOrderCounts.map((count, hour) => (
                  <View key={hour} style={styles.barColumn}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: count === 0 ? 0 : Math.max(4, (count / maxHourlyCount) * CHART_HEIGHT) },
                        ]}
                      />
                    </View>
                    {hour % 3 === 0 ? <Text style={styles.barLabel}>{formatHourLabel(hour)}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, width: 60 },
  backText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  title: { fontSize: 17, fontWeight: '900', color: colors.text },
  rangeRow: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 20, marginBottom: 6 },
  rangeChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  rangeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeChipText: { fontSize: 12.5, fontWeight: '800', color: colors.subtext },
  rangeChipTextActive: { color: '#fff' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  content: { padding: 20, paddingTop: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    flexBasis: '47%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...tintedShadow(colors.text, 0.04),
  },
  statValue: { fontSize: 22, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 11.5, fontWeight: '700', color: colors.subtext, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 16,
    ...tintedShadow(colors.text, 0.04),
  },
  cardTitle: { fontSize: 13.5, fontWeight: '900', color: colors.text, textAlign: 'right', marginBottom: 14 },
  emptyNote: { fontSize: 12, fontWeight: '700', color: colors.subtext, textAlign: 'center', paddingVertical: 12 },
  prepRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 12 },
  prepBlock: { alignItems: 'center' },
  prepValue: { fontSize: 20, fontWeight: '900', color: colors.text },
  prepLabel: { fontSize: 11, fontWeight: '700', color: colors.subtext, marginTop: 3 },
  prepBanner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, borderRadius: radius.md, padding: 10 },
  prepBannerGood: { backgroundColor: colors.successBg },
  prepBannerBad: { backgroundColor: colors.dangerBg },
  prepBannerText: { fontSize: 12, fontWeight: '800', flex: 1, textAlign: 'right' },
  chartWrap: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: CHART_HEIGHT + 20 },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_HEIGHT + 20 },
  barTrack: { width: 5, height: CHART_HEIGHT, justifyContent: 'flex-end' },
  barFill: { width: 5, borderRadius: 3, backgroundColor: colors.primary },
  barLabel: { fontSize: 8.5, fontWeight: '700', color: colors.subtext, marginTop: 4 },
});
