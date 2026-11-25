import React, { useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, tintedShadow } from '../theme';
import { submitFeeJustification } from '../api';
import type { Restaurant, RestaurantFee } from '../api';

type Props = {
  restaurant: Restaurant;
  token: string;
  refreshing: boolean;
  onRefresh: () => void;
};

const CADENCE_LABEL: Record<RestaurantFee['cadence'], string> = {
  once: 'مرة واحدة',
  weekly: 'أسبوعي',
  monthly: 'شهري',
};

const JUSTIFICATION_STATUS_META: Record<'pending' | 'approved' | 'rejected', { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'التبرير قيد المراجعة', color: colors.warning, bg: colors.warningBg, icon: 'time-outline' },
  approved: { label: 'تم قبول التبرير وإلغاء الرسوم', color: colors.success, bg: colors.successBg, icon: 'checkmark-circle' },
  rejected: { label: 'تم رفض التبرير', color: colors.danger, bg: colors.dangerBg, icon: 'close-circle' },
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
}

export default function ViolationsScreen({ restaurant, token, refreshing, onRefresh }: Props) {
  const fees = restaurant.recurringFees ?? [];
  const activeFees = fees.filter((fee) => fee.isActive);
  const totalActiveAmount = activeFees.reduce((sum, fee) => sum + fee.amount, 0);

  const [modalFeeId, setModalFeeId] = useState<string | null>(null);
  const [justificationText, setJustificationText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const openJustificationModal = (feeId: string) => {
    setModalFeeId(feeId);
    setJustificationText('');
    setError('');
  };

  const handleSubmitJustification = async () => {
    if (!modalFeeId) return;
    if (justificationText.trim().length < 5) {
      setError('يرجى كتابة تبرير لا يقل عن 5 أحرف.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitFeeJustification(token, modalFeeId, justificationText.trim());
      setModalFeeId(null);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال التبرير.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>المخالفات والغرامات</Text>
      </View>

      {(restaurant.maxCancellationsAllowed ?? 0) > 0 && (
        <View style={styles.policyCard}>
          <Ionicons name="information-circle" size={16} color={colors.warning} />
          <Text style={styles.policyText}>
            سياسة متجرك الحالية: يُسمح بإلغاء {restaurant.maxCancellationsAllowed} طلبات، وبعدها تُضاف غرامة {restaurant.cancellationPenaltyAmount} ر.س تلقائيًا مع كل تجاوز جديد.
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {fees.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={34} color={colors.success} />
            </View>
            <Text style={styles.emptyTitle}>سجلّك نظيف تمامًا</Text>
            <Text style={styles.emptyBody}>لا توجد أي مخالفات أو غرامات مسجّلة على متجرك حتى الآن.</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>إجمالي الرسوم النشطة</Text>
              <Text style={styles.summaryValue}>{totalActiveAmount} ر.س</Text>
            </View>
            {fees.map((fee) => {
              const statusMeta = fee.justificationStatus ? JUSTIFICATION_STATUS_META[fee.justificationStatus] : null;
              const canJustify = fee.isActive && (!fee.justificationStatus || fee.justificationStatus === 'rejected');
              return (
                <View key={fee.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.feeType}>{fee.type}</Text>
                    <View style={[styles.badge, fee.isActive ? styles.badgeActive : styles.badgeInactive]}>
                      <Text style={[styles.badgeText, fee.isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
                        {fee.isActive ? 'نشطة' : 'موقوفة'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.feeAmount}>{fee.amount} ر.س · {CADENCE_LABEL[fee.cadence]}</Text>
                  <Text style={styles.feeDate}>تاريخ البدء: {formatDate(fee.startDate)}</Text>

                  {statusMeta ? (
                    <View style={[styles.statusBox, { backgroundColor: statusMeta.bg }]}>
                      <View style={styles.statusHeader}>
                        <Ionicons name={statusMeta.icon} size={14} color={statusMeta.color} />
                        <Text style={[styles.statusLabel, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                      </View>
                      {fee.justification ? <Text style={styles.statusJustification}>{fee.justification}</Text> : null}
                      {fee.justificationDecisionNote ? (
                        <Text style={styles.statusDecisionNote}>ملاحظة الإدارة: {fee.justificationDecisionNote}</Text>
                      ) : null}
                    </View>
                  ) : null}

                  {canJustify ? (
                    <TouchableOpacity style={styles.justifyButton} onPress={() => openJustificationModal(fee.id)} activeOpacity={0.8}>
                      <Ionicons name="chatbox-ellipses-outline" size={15} color={colors.primary} />
                      <Text style={styles.justifyButtonText}>{fee.justificationStatus === 'rejected' ? 'إعادة تقديم تبرير' : 'تقديم تبرير'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal visible={modalFeeId !== null} transparent animationType="fade" onRequestClose={() => setModalFeeId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>تقديم تبرير للمخالفة</Text>
            <Text style={styles.modalSubtitle}>سيصل تبريرك مباشرة لمسؤول المنصة الذي سيراجعه ويقرر بشأن الرسوم.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="اشرح سبب اعتراضك على هذه المخالفة..."
              placeholderTextColor={colors.muted}
              value={justificationText}
              onChangeText={setJustificationText}
              multiline
              textAlign="right"
            />
            {error ? <Text style={styles.modalError}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalFeeId(null)} disabled={submitting}>
                <Text style={styles.modalCancelText}>تراجع</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleSubmitJustification} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>إرسال التبرير</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14 },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'right' },
  policyCard: { flexDirection: 'row-reverse', gap: spacing.xs, alignItems: 'flex-start', backgroundColor: colors.warningBg, borderRadius: 14, padding: 14, marginHorizontal: 20, marginBottom: 14, borderWidth: 1, borderColor: colors.warningBorder },
  policyText: { flex: 1, color: colors.warning, fontSize: 12, fontWeight: '700', textAlign: 'right', lineHeight: 18 },
  list: { paddingHorizontal: 20, paddingBottom: 30 },
  emptyWrap: { alignItems: 'center', marginTop: 50, paddingHorizontal: spacing.lg },
  emptyIconWrap: { width: 76, height: 76, borderRadius: radius.pill, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: spacing.xs },
  emptyBody: { fontSize: 13, color: colors.subtext, textAlign: 'center', lineHeight: 20 },
  summaryCard: { backgroundColor: colors.card, borderRadius: 18, padding: 18, marginBottom: 14, alignItems: 'center', ...tintedShadow(colors.text, 0.05) },
  summaryLabel: { color: colors.subtext, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  summaryValue: { color: colors.danger, fontSize: 26, fontWeight: '900' },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, ...tintedShadow(colors.text, 0.05) },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  feeType: { fontWeight: '900', color: colors.text, fontSize: 14, textAlign: 'right', flexShrink: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeActive: { backgroundColor: colors.dangerBg },
  badgeInactive: { backgroundColor: colors.neutralTint },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextActive: { color: colors.danger },
  badgeTextInactive: { color: colors.subtext },
  feeAmount: { color: colors.text, fontWeight: '800', fontSize: 15, textAlign: 'right', marginBottom: 4 },
  feeDate: { color: colors.subtext, fontSize: 11, fontWeight: '600', textAlign: 'right' },

  statusBox: { marginTop: spacing.sm + 2, borderRadius: radius.md, padding: spacing.sm + 2 },
  statusHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginBottom: 4 },
  statusLabel: { fontSize: 12, fontWeight: '800' },
  statusJustification: { fontSize: 11.5, fontWeight: '600', color: colors.text, textAlign: 'right', lineHeight: 17 },
  statusDecisionNote: { fontSize: 10.5, fontWeight: '600', color: colors.subtext, textAlign: 'right', marginTop: 4 },

  justifyButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.sm + 2, backgroundColor: colors.primaryTint, borderRadius: radius.md, paddingVertical: 10 },
  justifyButtonText: { color: colors.primary, fontWeight: '800', fontSize: 12.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.card, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: colors.text, textAlign: 'right', marginBottom: 6 },
  modalSubtitle: { fontSize: 12, fontWeight: '600', color: colors.subtext, textAlign: 'right', marginBottom: spacing.sm + 2, lineHeight: 17 },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, minHeight: 100, textAlignVertical: 'top', color: colors.text, fontSize: 14 },
  modalError: { color: colors.danger, fontSize: 11.5, fontWeight: '700', textAlign: 'right', marginTop: 6 },
  modalActions: { flexDirection: 'row-reverse', gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: colors.neutralTint },
  modalCancelText: { color: colors.subtext, fontWeight: '800' },
  modalConfirm: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: colors.primary },
  modalConfirmText: { color: '#fff', fontWeight: '800' },
});
