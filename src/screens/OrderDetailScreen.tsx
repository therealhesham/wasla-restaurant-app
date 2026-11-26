import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, tintedShadow, getStatusMeta } from '../theme';
import { fetchOrderCourier } from '../api';
import type { CourierInfo, Order } from '../api';

const RATEABLE_STATUSES = ['delivered', 'closed'];

const TERMINAL_STATUSES = ['delivered', 'closed', 'cancelled', 'deliveryFailed', 'returned'];
const ISSUE_STATUSES = ['cancelled', 'deliveryFailed', 'returned'];

const JOURNEY_STEPS: { status: string; label: string; icon: keyof typeof Ionicons.glyphMap; getTime: (order: Order) => string | undefined }[] = [
  { status: 'new', label: 'استلام الطلب', icon: 'document-text-outline', getTime: (o) => o.createdAt },
  { status: 'preparing', label: 'قيد التجهيز', icon: 'flame-outline', getTime: () => undefined },
  { status: 'readyForPickup', label: 'جاهز للاستلام', icon: 'bag-check-outline', getTime: (o) => o.readyForPickupAt || o.preparationReadyAt },
  { status: 'pickedUp', label: 'استلمه السائق', icon: 'hand-left-outline', getTime: (o) => o.pickedUpAt || o.handedToCourierAt },
  { status: 'onTheWay', label: 'في الطريق للعميل', icon: 'navigate-outline', getTime: (o) => o.onTheWayAt || o.tripStartedAt },
  { status: 'delivered', label: 'تم التسليم', icon: 'checkmark-done-outline', getTime: (o) => o.deliveredAt || o.closedAt },
];

// يجب أن تحتوي كل حالة يمرّ بها الطلب: أي حالة ناقصة (كانت 'accepted' ناقصة) تجعل indexOf يرجع ‎-1
// فتظهر كل المراحل "لم يصل بعد" لحظة قبول السائق للطلب.
const JOURNEY_ORDER = ['new', 'preparing', 'readyForPickup', 'assigned', 'accepted', 'pickedUp', 'onTheWay', 'delivered', 'closed'];
const WITH_COURIER_STATUSES = ['pickedUp', 'onTheWay'];

type Props = {
  order: Order;
  token: string;
  onBack: () => void;
  onMarkReady: (orderId: string) => Promise<void>;
  onCancel: (orderId: string, reason: string) => Promise<void>;
  onRateCourier: (orderId: string, rating: number) => Promise<void>;
};

function formatDateTime(value?: string) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

function SectionCard({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionIconWrap}>
          <Ionicons name={icon} size={15} color={colors.primary} />
        </View>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowValue}>{value}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
  );
}

export default function OrderDetailScreen({ order, token, onBack, onMarkReady, onCancel, onRateCourier }: Props) {
  const meta = getStatusMeta(order.status);
  const [acting, setActing] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const [courierModalVisible, setCourierModalVisible] = useState(false);
  const [courierLoading, setCourierLoading] = useState(false);
  const [courierError, setCourierError] = useState('');
  const [courierInfo, setCourierInfo] = useState<CourierInfo | null>(null);

  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState('');

  const canMarkReady = order.status === 'preparing';
  const canCancel = !TERMINAL_STATUSES.includes(order.status);
  const cancelAfterPickup = WITH_COURIER_STATUSES.includes(order.status);
  const hasIssue = ISSUE_STATUSES.includes(order.status);
  const currentStepIndex = JOURNEY_ORDER.indexOf(order.status);
  const total = order.mealAmount + order.deliveryFee;
  const canRateCourier = RATEABLE_STATUSES.includes(order.status) && Boolean(order.courierName);

  const handleMarkReady = async () => {
    setActing(true);
    setError('');
    try {
      await onMarkReady(order.id);
    } catch (err: any) {
      setError(err?.message || 'تعذر تحديث حالة الطلب.');
    } finally {
      setActing(false);
    }
  };

  const handleConfirmCancel = async () => {
    setActing(true);
    setError('');
    try {
      await onCancel(order.id, reason);
      setCancelVisible(false);
      setReason('');
    } catch (err: any) {
      setError(err?.message || 'تعذر إلغاء الطلب.');
    } finally {
      setActing(false);
    }
  };

  const openCourierDetails = async () => {
    setCourierModalVisible(true);
    setCourierLoading(true);
    setCourierError('');
    setCourierInfo(null);
    try {
      const info = await fetchOrderCourier(token, order.id);
      setCourierInfo(info);
    } catch (err: any) {
      setCourierError(err?.message || 'تعذر جلب بيانات السائق.');
    } finally {
      setCourierLoading(false);
    }
  };

  const handleRateStar = async (rating: number) => {
    setRatingSubmitting(true);
    setRatingError('');
    try {
      await onRateCourier(order.id, rating);
    } catch (err: any) {
      setRatingError(err?.message || 'تعذر إرسال التقييم.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const issueText = order.cancelReason || order.deliveryFailureReason || order.returnReason;
  const issueLabel = order.cancelReason ? 'سبب الإلغاء' : order.deliveryFailureReason ? 'سبب فشل التوصيل' : 'سبب الإرجاع';
  const issueAt = order.cancelledAt || order.deliveryFailedAt || order.returnedAt;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>تفاصيل الطلب</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.heroCard}>
        <View style={[styles.heroIconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon as any} size={30} color={meta.color} />
        </View>
        <Text style={[styles.heroStatus, { color: meta.color }]}>{meta.label}</Text>
        <Text style={styles.heroOrderNumber}>{order.orderNumber || order.id}</Text>
        <Text style={styles.heroTime}>{formatDateTime(order.createdAt)}</Text>
      </View>

      {hasIssue ? (
        <View style={styles.issueCard}>
          <View style={styles.issueHeader}>
            <Ionicons name="alert-circle" size={17} color={colors.danger} />
            <Text style={styles.issueTitle}>{issueLabel}</Text>
            {issueAt ? <Text style={styles.issueTime}>{formatDateTime(issueAt)}</Text> : null}
          </View>
          <Text style={styles.issueBody}>{issueText || 'بدون تفاصيل إضافية.'}</Text>
        </View>
      ) : (
        <View style={styles.journeyCard}>
          <Text style={styles.journeyTitle}>مراحل الطلب بالتفصيل</Text>
          {JOURNEY_STEPS.map((step, index) => {
            const stepIndex = JOURNEY_ORDER.indexOf(step.status);
            const done = currentStepIndex >= 0 && stepIndex <= currentStepIndex;
            const isCurrent = step.status === order.status;
            const time = formatDateTime(step.getTime(order));
            return (
              <View key={step.status} style={styles.timelineRow}>
                <View style={styles.timelineTrack}>
                  <View style={[styles.timelineDot, done ? styles.timelineDotDone : null, isCurrent ? styles.timelineDotCurrent : null]}>
                    <Ionicons name={step.icon} size={13} color={done ? '#fff' : colors.muted} />
                  </View>
                  {index < JOURNEY_STEPS.length - 1 ? (
                    <View style={[styles.timelineLine, done && stepIndex < currentStepIndex ? styles.timelineLineDone : null]} />
                  ) : null}
                </View>
                <View style={styles.timelineTextWrap}>
                  <Text style={[styles.timelineLabel, done ? styles.timelineLabelDone : null]}>{step.label}</Text>
                  <Text style={styles.timelineTime}>{time || (done ? '—' : 'لم يصل بعد')}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <SectionCard icon="person-outline" title="العميل">
        <InfoRow label="الاسم" value={order.customerName} />
        <View style={styles.phoneRow}>
          <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL(`tel:${order.phone}`)}>
            <Ionicons name="call" size={15} color={colors.success} />
          </TouchableOpacity>
          <Text style={styles.rowLabel}>الجوال</Text>
          <Text style={[styles.rowValue, { flex: 1 }]}>{order.phone}</Text>
        </View>
        <InfoRow label="المنطقة" value={order.area} />
        <InfoRow label="العنوان" value={order.address} />
      </SectionCard>

      <SectionCard icon="cash-outline" title="الدفع">
        <InfoRow label="قيمة الوجبة" value={`${order.mealAmount} ر.س`} />
        <InfoRow label="رسوم التوصيل" value={`${order.deliveryFee} ر.س`} />
        <View style={styles.totalRow}>
          <Text style={styles.totalValue}>{total.toFixed(0)} ر.س</Text>
          <Text style={styles.totalLabel}>الإجمالي</Text>
        </View>
        {order.collectedAmount ? <InfoRow label="تم تحصيله" value={`${order.collectedAmount} ر.س`} /> : null}
        {order.paymentMethodName ? <InfoRow label="طريقة الدفع" value={order.paymentMethodName} /> : null}
      </SectionCard>

      <SectionCard icon="bicycle-outline" title="السائق">
        {order.courierName ? (
          <TouchableOpacity style={styles.courierRow} onPress={openCourierDetails} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={16} color={colors.muted} />
            <View style={{ flex: 1 }} />
            <Text style={styles.courierName}>{order.courierName}</Text>
            <View style={styles.courierAvatar}>
              <Ionicons name="person" size={16} color={colors.accent} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingRow}>
            <Ionicons name="time-outline" size={15} color={colors.subtext} />
            <Text style={styles.waitingText}>بانتظار إسناد سائق</Text>
          </View>
        )}
      </SectionCard>

      {(order.pickupProofUri || order.deliveryProofUri) && (
        <SectionCard icon="camera-outline" title="صور الإثبات">
          <View style={styles.proofRow}>
            {order.pickupProofUri ? (
              <TouchableOpacity style={styles.proofItem} onPress={() => Linking.openURL(order.pickupProofUri as string)} activeOpacity={0.85}>
                <Image source={{ uri: order.pickupProofUri }} style={styles.proofImage} />
                <View style={styles.proofLabelRow}>
                  <Ionicons name="storefront-outline" size={12} color={colors.subtext} />
                  <Text style={styles.proofLabel}>استلام من المتجر</Text>
                </View>
              </TouchableOpacity>
            ) : null}
            {order.deliveryProofUri ? (
              <TouchableOpacity style={styles.proofItem} onPress={() => Linking.openURL(order.deliveryProofUri as string)} activeOpacity={0.85}>
                <Image source={{ uri: order.deliveryProofUri }} style={styles.proofImage} />
                <View style={styles.proofLabelRow}>
                  <Ionicons name="home-outline" size={12} color={colors.subtext} />
                  <Text style={styles.proofLabel}>تسليم للعميل</Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </SectionCard>
      )}

      {canRateCourier && (
        <SectionCard icon="star-outline" title="تقييم السائق">
          {order.courierRating ? (
            <View style={styles.ratingDoneRow}>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Ionicons key={n} name={n <= (order.courierRating as number) ? 'star' : 'star-outline'} size={26} color={colors.warning} />
                ))}
              </View>
              <View style={styles.ratingDoneBadge}>
                <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                <Text style={styles.ratingDoneText}>تم التقييم</Text>
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.ratingPrompt}>كيف كانت تجربتك مع {order.courierName}؟</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => handleRateStar(n)} disabled={ratingSubmitting} hitSlop={6}>
                    <Ionicons name="star-outline" size={32} color={colors.warning} />
                  </TouchableOpacity>
                ))}
              </View>
              {ratingSubmitting ? <ActivityIndicator color={colors.warning} style={{ marginTop: spacing.xs }} /> : null}
              {ratingError ? <Text style={styles.ratingError}>{ratingError}</Text> : null}
            </View>
          )}
        </SectionCard>
      )}

      {order.notes ? (
        <SectionCard icon="chatbox-ellipses-outline" title="ملاحظات">
          <Text style={styles.notesText}>{order.notes}</Text>
        </SectionCard>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {(canMarkReady || canCancel) && (
        <View style={styles.actions}>
          {canMarkReady && (
            <TouchableOpacity style={styles.readyButton} onPress={handleMarkReady} disabled={acting}>
              {acting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.readyButtonText}>تم التجهيز — جاهز للاستلام</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity style={styles.cancelButton} onPress={() => setCancelVisible(true)} disabled={acting}>
              <Ionicons name="close-circle-outline" size={17} color={colors.danger} />
              <Text style={styles.cancelButtonText}>إلغاء الطلب</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal visible={cancelVisible} transparent animationType="fade" onRequestClose={() => setCancelVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>سبب إلغاء الطلب</Text>
            {cancelAfterPickup ? (
              <Text style={styles.cancelWarning}>
                تنبيه: السائق استلم هذا الطلب من المتجر وهو الآن معه. تواصل معه قبل الإلغاء حتى لا يكمل التوصيل.
              </Text>
            ) : null}
            <TextInput
              style={styles.modalInput}
              placeholder="اكتب سبب الإلغاء (اختياري)"
              placeholderTextColor={colors.muted}
              value={reason}
              onChangeText={setReason}
              multiline
              textAlign="right"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCancelVisible(false)} disabled={acting}>
                <Text style={styles.modalCancelText}>تراجع</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleConfirmCancel} disabled={acting}>
                {acting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>تأكيد الإلغاء</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={courierModalVisible} transparent animationType="fade" onRequestClose={() => setCourierModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {courierLoading ? (
              <View style={styles.courierModalLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : courierError ? (
              <View style={styles.courierModalLoading}>
                <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
                <Text style={styles.courierModalError}>{courierError}</Text>
              </View>
            ) : courierInfo ? (
              <>
                <View style={styles.courierModalHero}>
                  <View style={styles.courierModalAvatar}>
                    <Ionicons name="person" size={30} color={colors.accent} />
                  </View>
                  <Text style={styles.courierModalName}>{courierInfo.name}</Text>
                  <View style={[styles.courierOnlinePill, { backgroundColor: courierInfo.isOnline ? colors.successBg : colors.neutralTint }]}>
                    <View style={[styles.courierOnlineDot, { backgroundColor: courierInfo.isOnline ? colors.success : colors.muted }]} />
                    <Text style={[styles.courierOnlineText, { color: courierInfo.isOnline ? colors.success : colors.subtext }]}>
                      {courierInfo.isOnline ? 'متصل الآن' : 'غير متصل'}
                    </Text>
                  </View>
                </View>

                {courierInfo.phone ? (
                  <View style={styles.phoneRow}>
                    <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL(`tel:${courierInfo.phone}`)}>
                      <Ionicons name="call" size={15} color={colors.success} />
                    </TouchableOpacity>
                    <Text style={styles.rowLabel}>الجوال</Text>
                    <Text style={[styles.rowValue, { flex: 1 }]}>{courierInfo.phone}</Text>
                  </View>
                ) : null}
                {courierInfo.vehicleType ? <InfoRow label="نوع المركبة" value={courierInfo.vehicleType} /> : null}
                {courierInfo.vehicleModel ? <InfoRow label="موديل المركبة" value={courierInfo.vehicleModel} /> : null}
                {courierInfo.vehicleColor ? <InfoRow label="لون المركبة" value={courierInfo.vehicleColor} /> : null}
                {courierInfo.vehiclePlateNumber ? <InfoRow label="رقم اللوحة" value={courierInfo.vehiclePlateNumber} /> : null}
                {courierInfo.distanceKm != null ? <InfoRow label="المسافة" value={`${courierInfo.distanceKm} كم`} /> : null}
                {courierInfo.estimatedArrivalMinutes != null ? <InfoRow label="الوصول المتوقع" value={`${courierInfo.estimatedArrivalMinutes} دقيقة`} /> : null}
              </>
            ) : null}

            <TouchableOpacity style={styles.modalDismiss} onPress={() => setCourierModalVisible(false)}>
              <Text style={styles.modalDismissText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 40 },
  cancelWarning: { color: colors.danger, backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, fontSize: 12.5, fontWeight: '700', textAlign: 'right', lineHeight: 19 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14 },
  backButton: { flexDirection: 'row-reverse', alignItems: 'center', width: 60 },
  backText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  title: { fontSize: 18, fontWeight: '900', color: colors.text },

  heroCard: { alignItems: 'center', marginHorizontal: 20, backgroundColor: colors.card, borderRadius: radius.xl, paddingVertical: spacing.lg, marginBottom: spacing.md, ...tintedShadow(colors.text, 0.05) },
  heroIconWrap: { width: 68, height: 68, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  heroStatus: { fontSize: 18, fontWeight: '900', marginBottom: 4 },
  heroOrderNumber: { fontSize: 13, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  heroTime: { fontSize: 11.5, fontWeight: '600', color: colors.subtext, marginTop: 4 },

  issueCard: { backgroundColor: colors.dangerBg, borderRadius: radius.lg, padding: spacing.md, marginHorizontal: 20, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.dangerBorder },
  issueHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  issueTitle: { color: colors.danger, fontWeight: '900', fontSize: 14, flex: 1, textAlign: 'right' },
  issueTime: { color: colors.danger, fontSize: 11, fontWeight: '700', opacity: 0.8 },
  issueBody: { color: colors.danger, fontSize: 12.5, fontWeight: '600', textAlign: 'right', lineHeight: 19, opacity: 0.9 },

  journeyCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginHorizontal: 20, marginBottom: spacing.md, ...tintedShadow(colors.text, 0.04) },
  journeyTitle: { fontSize: 14, fontWeight: '900', color: colors.text, textAlign: 'right', marginBottom: spacing.sm + spacing.xs },
  timelineRow: { flexDirection: 'row-reverse' },
  timelineTrack: { alignItems: 'center', width: 34 },
  timelineDot: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.neutralTint, alignItems: 'center', justifyContent: 'center' },
  timelineDotDone: { backgroundColor: colors.primary },
  timelineDotCurrent: { ...tintedShadow(colors.primary, 0.4) },
  timelineLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: colors.neutralTint, marginVertical: 2 },
  timelineLineDone: { backgroundColor: colors.primary },
  timelineTextWrap: { flex: 1, paddingRight: spacing.sm, paddingBottom: spacing.md },
  timelineLabel: { fontSize: 13, fontWeight: '800', color: colors.muted, textAlign: 'right' },
  timelineLabelDone: { color: colors.text },
  timelineTime: { fontSize: 11, fontWeight: '600', color: colors.subtext, textAlign: 'right', marginTop: 2 },

  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginHorizontal: 20, marginBottom: spacing.md, ...tintedShadow(colors.text, 0.04) },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
  sectionIconWrap: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },

  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.neutralTint },
  rowLabel: { color: colors.subtext, fontSize: 13, fontWeight: '700' },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '800', flexShrink: 1, textAlign: 'left' },

  phoneRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.neutralTint, gap: spacing.xs },
  callButton: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },

  totalRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  totalLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  totalValue: { color: colors.primary, fontSize: 19, fontWeight: '900' },

  courierRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  courierAvatar: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' },
  courierName: { fontSize: 14, fontWeight: '800', color: colors.text },
  waitingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  waitingText: { color: colors.subtext, fontSize: 13, fontWeight: '700' },

  proofRow: { flexDirection: 'row-reverse', gap: spacing.sm },
  proofItem: { flex: 1 },
  proofImage: { width: '100%', height: 120, borderRadius: radius.md, backgroundColor: colors.neutralTint },
  proofLabelRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 6, justifyContent: 'center' },
  proofLabel: { fontSize: 10.5, fontWeight: '700', color: colors.subtext },

  ratingPrompt: { fontSize: 12.5, fontWeight: '700', color: colors.subtext, textAlign: 'center', marginBottom: spacing.sm },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  ratingDoneRow: { alignItems: 'center', gap: spacing.xs },
  ratingDoneBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: colors.successBg, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
  ratingDoneText: { fontSize: 11, fontWeight: '800', color: colors.success },
  ratingError: { color: colors.danger, fontSize: 11.5, fontWeight: '700', textAlign: 'center', marginTop: spacing.xs },

  notesText: { color: colors.text, fontSize: 13, fontWeight: '600', textAlign: 'right', lineHeight: 20 },

  errorText: { color: colors.danger, textAlign: 'center', marginTop: 4, marginBottom: spacing.sm, marginHorizontal: 20, fontWeight: '700', fontSize: 13 },
  actions: { marginHorizontal: 20, marginTop: spacing.xs, gap: 12 },
  readyButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.success, borderRadius: 16, paddingVertical: 15 },
  readyButtonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  cancelButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.dangerBg, borderRadius: 16, paddingVertical: 15, borderWidth: 1, borderColor: colors.dangerBorder },
  cancelButtonText: { color: colors.danger, fontWeight: '900', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.card, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: colors.text, textAlign: 'right', marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, minHeight: 80, textAlignVertical: 'top', color: colors.text, fontSize: 14 },
  modalActions: { flexDirection: 'row-reverse', gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: colors.neutralTint },
  modalCancelText: { color: colors.subtext, fontWeight: '800' },
  modalConfirm: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: colors.danger },
  modalConfirmText: { color: '#fff', fontWeight: '800' },

  courierModalLoading: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  courierModalError: { color: colors.danger, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  courierModalHero: { alignItems: 'center', marginBottom: spacing.md },
  courierModalAvatar: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  courierModalName: { fontSize: 17, fontWeight: '900', color: colors.text, marginBottom: 6 },
  courierOnlinePill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.pill },
  courierOnlineDot: { width: 7, height: 7, borderRadius: radius.pill },
  courierOnlineText: { fontSize: 11, fontWeight: '800' },
  modalDismiss: { marginTop: spacing.md, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: colors.neutralTint },
  modalDismissText: { color: colors.subtext, fontWeight: '800' },
});
