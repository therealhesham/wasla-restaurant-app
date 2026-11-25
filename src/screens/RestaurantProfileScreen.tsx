import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, tintedShadow } from '../theme';
import type { Restaurant, RestaurantDocument } from '../api';

type Props = {
  restaurant: Restaurant;
  onBack: () => void;
  onOpenSupport: () => void;
  onOpenAnalytics: () => void;
};

const DOC_STATUS_META: Record<RestaurantDocument['status'], { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  valid: { label: 'ساري', color: colors.success, bg: colors.successBg, icon: 'checkmark-circle' },
  expiring_soon: { label: 'قارب على الانتهاء', color: colors.warning, bg: colors.warningBg, icon: 'time' },
  expired: { label: 'منتهي', color: colors.danger, bg: colors.dangerBg, icon: 'alert-circle' },
  missing: { label: 'لم يُرفع', color: colors.muted, bg: colors.neutralTint, icon: 'cloud-upload-outline' },
};

function formatDate(value: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
}

const DELIVERY_POLICY_LABEL: Record<string, string> = {
  fixed: 'ثابتة',
  percentage: 'نسبة مئوية',
  manual: 'يدوية لكل طلب',
};

export default function RestaurantProfileScreen({ restaurant, onBack, onOpenSupport, onOpenAnalytics }: Props) {
  const documents = restaurant.documents ?? [];
  const validCount = documents.filter((doc) => doc.status === 'valid').length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ملف المتجر</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="storefront" size={32} color={colors.primary} />
        </View>
        <Text style={styles.heroName}>{restaurant.name}</Text>
        {restaurant.businessType ? <Text style={styles.heroType}>{restaurant.businessType}</Text> : null}

        <View style={[styles.statusPill, restaurant.complianceSuspended ? styles.statusPillDanger : styles.statusPillOk]}>
          <Ionicons
            name={restaurant.complianceSuspended ? 'close-circle' : 'checkmark-circle'}
            size={14}
            color={restaurant.complianceSuspended ? colors.danger : colors.success}
          />
          <Text style={[styles.statusPillText, { color: restaurant.complianceSuspended ? colors.danger : colors.success }]}>
            {restaurant.complianceSuspended ? 'المتجر متوقف مؤقتًا' : 'المتجر نشط'}
          </Text>
        </View>
      </View>

      {restaurant.complianceSuspended && restaurant.complianceSuspensionReason ? (
        <View style={styles.suspendedBanner}>
          <Text style={styles.suspendedText}>{restaurant.complianceSuspensionReason}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.supportCard} onPress={onOpenAnalytics} activeOpacity={0.8}>
        <Ionicons name="chevron-back" size={16} color={colors.subtext} />
        <View style={{ flex: 1 }}>
          <Text style={styles.supportTitle}>تحليلات الأداء</Text>
          <Text style={styles.supportSubtitle}>وقت التجهيز، ساعات الذروة، ونسبة الالتزام بالوعد</Text>
        </View>
        <View style={styles.supportIconWrap}>
          <Ionicons name="stats-chart-outline" size={18} color={colors.accent} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.supportCard} onPress={onOpenSupport} activeOpacity={0.8}>
        <Ionicons name="chevron-back" size={16} color={colors.subtext} />
        <View style={{ flex: 1 }}>
          <Text style={styles.supportTitle}>الدعم الفني</Text>
          <Text style={styles.supportSubtitle}>راسلنا لأي استفسار أو مشكلة</Text>
        </View>
        <View style={styles.supportIconWrap}>
          <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
        </View>
      </TouchableOpacity>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>معلومات المتجر</Text>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
          </View>
        </View>
        <InfoRow icon="call-outline" label="الجوال" value={restaurant.phone} />
        <InfoRow icon="mail-outline" label="البريد الإلكتروني" value={restaurant.email} />
        <InfoRow icon="location-outline" label="المدينة" value={restaurant.city} />
        <InfoRow icon="pin-outline" label="العنوان" value={restaurant.address} last />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>سياسة التوصيل</Text>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="bicycle-outline" size={15} color={colors.primary} />
          </View>
        </View>
        <InfoRow
          icon="options-outline"
          label="نوع الرسوم"
          value={restaurant.deliveryFeePolicyName || DELIVERY_POLICY_LABEL[restaurant.deliveryFeePolicy ?? ''] || '—'}
        />
        {restaurant.deliveryFeePolicy !== 'manual' ? (
          <InfoRow icon="cash-outline" label="القيمة" value={`${restaurant.deliveryFeeValue ?? 0}${restaurant.deliveryFeePolicy === 'percentage' ? '%' : ' ر.س'}`} last />
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>المستندات والامتثال</Text>
          <View style={styles.docsCountPill}>
            <Text style={styles.docsCountText}>{validCount}/{documents.length}</Text>
          </View>
        </View>

        {documents.map((doc, index) => {
          const meta = DOC_STATUS_META[doc.status];
          return (
            <View key={doc.type} style={[styles.docRow, index === documents.length - 1 ? { borderBottomWidth: 0 } : null]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.docLabel}>{doc.label}</Text>
                {doc.expiryDate ? (
                  <Text style={styles.docExpiry}>
                    {doc.status === 'expired' ? 'انتهى في' : 'ينتهي في'} {formatDate(doc.expiryDate)}
                  </Text>
                ) : (
                  <Text style={styles.docExpiry}>لم يُرفع بعد</Text>
                )}
              </View>

              {doc.fileUrl ? (
                <TouchableOpacity style={styles.viewButton} onPress={() => Linking.openURL(doc.fileUrl as string)}>
                  <Ionicons name="eye-outline" size={15} color={colors.accent} />
                </TouchableOpacity>
              ) : null}

              <View style={[styles.docBadge, { backgroundColor: meta.bg }]}>
                <Ionicons name={meta.icon} size={12} color={meta.color} />
                <Text style={[styles.docBadgeText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {(restaurant.maxCancellationsAllowed ?? 0) > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>سياسة الإلغاء</Text>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="warning-outline" size={15} color={colors.primary} />
            </View>
          </View>
          <InfoRow icon="ban-outline" label="الحد المسموح" value={`${restaurant.maxCancellationsAllowed} طلبات`} />
          <InfoRow icon="pricetag-outline" label="الغرامة عند التجاوز" value={`${restaurant.cancellationPenaltyAmount} ر.س`} last />
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last ? { borderBottomWidth: 0 } : null]}>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
      <View style={styles.rowLabelGroup}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Ionicons name={icon} size={14} color={colors.subtext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 40 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14 },
  backButton: { flexDirection: 'row-reverse', alignItems: 'center', width: 60 },
  backText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  title: { fontSize: 18, fontWeight: '900', color: colors.text },

  heroCard: { alignItems: 'center', marginHorizontal: 20, backgroundColor: colors.card, borderRadius: radius.xl, paddingVertical: spacing.lg, marginBottom: spacing.md, ...tintedShadow(colors.text, 0.05) },
  heroIconWrap: { width: 68, height: 68, borderRadius: radius.pill, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  heroName: { fontSize: 19, fontWeight: '900', color: colors.text, marginBottom: 2 },
  heroType: { fontSize: 12.5, fontWeight: '700', color: colors.subtext, marginBottom: spacing.sm },
  statusPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, marginTop: spacing.xs },
  statusPillOk: { backgroundColor: colors.successBg },
  statusPillDanger: { backgroundColor: colors.dangerBg },
  statusPillText: { fontSize: 12, fontWeight: '800' },

  supportCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginHorizontal: 20, marginBottom: spacing.md, ...tintedShadow(colors.text, 0.04) },
  supportIconWrap: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' },
  supportTitle: { fontSize: 13.5, fontWeight: '900', color: colors.text, textAlign: 'right' },
  supportSubtitle: { fontSize: 11, fontWeight: '700', color: colors.subtext, textAlign: 'right', marginTop: 2 },

  suspendedBanner: { backgroundColor: colors.dangerBg, borderRadius: radius.lg, padding: spacing.md, marginHorizontal: 20, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.dangerBorder },
  suspendedText: { color: colors.danger, fontSize: 12.5, fontWeight: '700', textAlign: 'right', lineHeight: 19 },

  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginHorizontal: 20, marginBottom: spacing.md, ...tintedShadow(colors.text, 0.04) },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
  sectionIconWrap: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  docsCountPill: { backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  docsCountText: { color: colors.primary, fontWeight: '900', fontSize: 12 },

  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.neutralTint },
  rowLabelGroup: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  rowLabel: { color: colors.subtext, fontSize: 13, fontWeight: '700' },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '800', flexShrink: 1, textAlign: 'left', marginLeft: spacing.sm },

  docRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.neutralTint },
  docLabel: { color: colors.text, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  docExpiry: { color: colors.subtext, fontSize: 11, fontWeight: '600', textAlign: 'right', marginTop: 2 },
  viewButton: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' },
  docBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill },
  docBadgeText: { fontSize: 10.5, fontWeight: '800' },
});
