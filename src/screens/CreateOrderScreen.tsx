import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, tintedShadow } from '../theme';
import { createLocationRequest, estimateDeliveryFee, lookupCustomerByPhone, pollLocationRequest } from '../api';
import type { CreateOrderInput, DeliveryFeeEstimate, Restaurant } from '../api';

type Props = {
  restaurant: Restaurant;
  token: string;
  onBack: () => void;
  onSubmit: (input: CreateOrderInput) => Promise<void>;
};

const SETTLEMENT_OPTIONS: {
  value: CreateOrderInput['settlementMode'];
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'courier_collects',
    label: 'الدفع عند الاستلام',
    description: 'المندوب يحصّل المبلغ من العميل ويسلّمه كاملًا للإدارة.',
    icon: 'cash-outline',
  },
  {
    value: 'courier_advances',
    label: 'محفظة المندوب',
    description: 'المندوب يدفع للمطعم من محفظته، ثم يحصّل المبلغ من العميل.',
    icon: 'swap-horizontal-outline',
  },
  {
    value: 'customer_prepaid',
    label: 'مدفوع مسبقًا',
    description: 'العميل سدّد المبلغ للمطعم مباشرة قبل التوصيل.',
    icon: 'checkmark-done-outline',
  },
];

export default function CreateOrderScreen({ restaurant, token, onBack, onSubmit }: Props) {
  const needsManualDeliveryFee = restaurant.deliveryFeePolicy === 'manual';

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState(restaurant.city || '');
  const [address, setAddress] = useState('');
  const [mealAmount, setMealAmount] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pos'>('cash');
  const [settlementMode, setSettlementMode] = useState<CreateOrderInput['settlementMode']>('courier_collects');
  const [mapLink, setMapLink] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [locationStatus, setLocationStatus] = useState<'idle' | 'sending' | 'waiting' | 'confirmed' | 'error'>('idle');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  // مصدر الإحداثيات الحالية: 'link' = العميل شارك موقعه عبر الرابط لهذا الطلب، 'saved' = موقع محفوظ
  // من طلب سابق لنفس رقم الجوال. الموقع المحفوظ يخص رقمًا بعينه ويجب أن يُمسح إذا تغيّر الرقم.
  const [locationSource, setLocationSource] = useState<'link' | 'saved' | null>(null);
  const locationSourceRef = useRef<'link' | 'saved' | null>(null);
  locationSourceRef.current = locationSource;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationRequestSeq = useRef(0);

  // معاينة حية لرسوم التوصيل عند سياسة "حسب المسافة" — تُحسب بمجرد ما يتوفر موقع العميل وقيمة
  // الوجبة، حتى يشوف المطعم الرقم الفعلي قبل تأكيد الطلب لا بعده.
  const isDistanceBasedFee = restaurant.deliveryFeePolicy === 'distance';
  const [feeEstimate, setFeeEstimate] = useState<DeliveryFeeEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState('');
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDistanceBasedFee) return;
    if (estimateTimer.current) clearTimeout(estimateTimer.current);

    const meal = Number(mealAmount);
    if (!locationCoords || !meal || meal <= 0) {
      setFeeEstimate(null);
      setEstimateError('');
      return;
    }

    estimateTimer.current = setTimeout(async () => {
      setEstimating(true);
      setEstimateError('');
      try {
        const result = await estimateDeliveryFee(token, {
          mealAmount: meal,
          customerLatitude: locationCoords.latitude,
          customerLongitude: locationCoords.longitude,
        });
        setFeeEstimate(result);
      } catch (err: any) {
        setFeeEstimate(null);
        setEstimateError(err?.message || 'تعذر حساب رسوم التوصيل.');
      } finally {
        setEstimating(false);
      }
    }, 500);

    return () => {
      if (estimateTimer.current) clearTimeout(estimateTimer.current);
    };
  }, [isDistanceBasedFee, mealAmount, locationCoords, token]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  // تعبئة تلقائية لبيانات عميل سابق بمجرد إدخال رقم جوال مطابق لطلب سابق لنفس المتجر — قابلة للتعديل بعدها بحرية.
  const [customerFound, setCustomerFound] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupSeq = useRef(0);
  // ما عبّأه آخر بحث ناجح — حتى نمسح عند تغيّر الرقم ما لم يعدّله المتجر بيده فقط.
  const autofilled = useRef<{ customerName: string; area: string; address: string; mapLink: string } | null>(null);

  // بيانات العميل السابق (وخاصة إحداثياته ورابط خريطته غير الظاهرَين بوضوح) لا يجوز أن تبقى بعد
  // تغيير رقم الجوال، وإلا يُنشأ طلب العميل الجديد على موقع العميل القديم ويذهب السائق للعنوان الخطأ.
  const clearAutofill = () => {
    const filled = autofilled.current;
    autofilled.current = null;
    setCustomerFound(false);
    if (filled) {
      setCustomerName((current) => (current === filled.customerName ? '' : current));
      setArea((current) => (current === filled.area ? restaurant.city || '' : current));
      setAddress((current) => (current === filled.address ? '' : current));
      setMapLink((current) => (current === filled.mapLink ? '' : current));
    }
    if (locationSourceRef.current === 'saved') {
      setLocationCoords(null);
      setLocationSource(null);
      setLocationStatus('idle');
    }
  };

  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    // أي بحث سابق ما زال بالطريق يخص رقمًا قديمًا — رقمه التسلسلي يصبح غير صالح فيُهمل رده.
    const seq = ++lookupSeq.current;
    clearAutofill();

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return;

    lookupTimer.current = setTimeout(async () => {
      try {
        const result = await lookupCustomerByPhone(token, phone);
        if (seq !== lookupSeq.current || !result) return;

        const filled = {
          customerName: result.customerName,
          area: result.area,
          address: result.address,
          mapLink: result.mapLink || '',
        };
        autofilled.current = filled;
        setCustomerName(filled.customerName);
        setArea(filled.area);
        setAddress(filled.address);
        if (filled.mapLink) setMapLink(filled.mapLink);
        // موقع أكّده العميل عبر الرابط لهذا الطلب أحدث من أي موقع محفوظ، فلا نكتب فوقه.
        if (
          locationSourceRef.current !== 'link' &&
          typeof result.customerLatitude === 'number' &&
          typeof result.customerLongitude === 'number'
        ) {
          setLocationCoords({ latitude: result.customerLatitude, longitude: result.customerLongitude });
          setLocationSource('saved');
          setLocationStatus('confirmed');
        }
        setCustomerFound(true);
      } catch {
        // تجاهل فشل البحث بصمت، المتجر يقدر يعبّي البيانات يدويًا كالمعتاد
      }
    }, 600);

    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, token]);

  const requestCustomerLocation = async () => {
    // إيقاف أي انتظار لطلب موقع سابق — وإلا يبقى يعمل بالخلفية وقد يكتب موقع الطلب القديم فوق الجديد.
    stopPolling();
    const requestSeq = ++locationRequestSeq.current;
    setLocationStatus('sending');
    try {
      const { token: requestToken, shareUrl } = await createLocationRequest(token);
      await Share.share({ message: `لتحديد عنوانك بدقة على الخريطة، افتح هذا الرابط واسمح بمشاركة موقعك:\n${shareUrl}` });

      setLocationStatus('waiting');
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const result = await pollLocationRequest(token, requestToken);
          if (requestSeq !== locationRequestSeq.current) return;
          if (result.status === 'resolved' && result.latitude && result.longitude) {
            stopPolling();
            setLocationCoords({ latitude: result.latitude, longitude: result.longitude });
            setLocationSource('link');
            setLocationStatus('confirmed');
          } else if (attempts > 60) {
            stopPolling();
            setLocationStatus('error');
          }
        } catch {
          if (requestSeq !== locationRequestSeq.current) return;
          stopPolling();
          setLocationStatus('error');
        }
      }, 4000);
    } catch (err: any) {
      setLocationStatus('error');
    }
  };

  const submit = async () => {
    setError('');

    if (customerName.trim().length < 2) return setError('اسم العميل مطلوب.');
    if (phone.trim().length < 8) return setError('رقم جوال العميل مطلوب (8 أرقام على الأقل).');
    if (area.trim().length < 2) return setError('المنطقة مطلوبة.');
    if (address.trim().length < 5) return setError('العنوان مطلوب (5 أحرف على الأقل).');
    const meal = Number(mealAmount);
    if (!meal || meal <= 0) return setError('قيمة الوجبة مطلوبة وأكبر من صفر.');
    const fee = needsManualDeliveryFee ? Number(deliveryFee) : 0;
    if (needsManualDeliveryFee && (!deliveryFee || fee < 0)) return setError('رسوم التوصيل مطلوبة.');

    setLoading(true);
    try {
      await onSubmit({
        customerName: customerName.trim(),
        phone: phone.trim(),
        area: area.trim(),
        address: address.trim(),
        mealAmount: meal,
        deliveryFee: fee,
        prepMinutes: 15,
        paymentMethod,
        settlementMode,
        notes: notes.trim() || undefined,
        mapLink: mapLink.trim() || undefined,
        customerLatitude: locationCoords?.latitude,
        customerLongitude: locationCoords?.longitude,
        locationMethod: locationCoords ? 'map-picker' : mapLink.trim() ? 'map-link' : undefined,
      });
    } catch (err: any) {
      setError(err?.message || 'تعذر إنشاء الطلب.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>طلب جديد</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <Field label="جوال العميل" value={phone} onChangeText={setPhone} placeholder="05XXXXXXXX" keyboardType="phone-pad" />
        {customerFound ? (
          <View style={styles.foundHint}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.foundHintText}>عميل سابق — تم تعبئة بياناته تلقائيًا، وتقدر تعدّلها.</Text>
          </View>
        ) : null}
        <Field label="اسم العميل" value={customerName} onChangeText={setCustomerName} placeholder="مثال: أحمد محمد" />
        <Field label="المنطقة" value={area} onChangeText={setArea} placeholder="مثال: رام الله" />
        <Field label="العنوان التفصيلي" value={address} onChangeText={setAddress} placeholder="اسم الشارع، أقرب معلم..." multiline />
        <Field label="رابط خرائط جوجل (اختياري)" value={mapLink} onChangeText={setMapLink} placeholder="الصق رابط الموقع من العميل" keyboardType="default" />

        <View style={styles.locationBox}>
          {locationStatus === 'confirmed' && locationCoords ? (
            <View style={styles.locationConfirmed}>
              <View style={styles.locationConfirmedRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.locationConfirmedText}>
                  {locationSource === 'saved' ? 'موقع محفوظ من طلب سابق لهذا العميل' : 'تم تأكيد موقع العميل عبر الرابط'}
                </Text>
              </View>
              <TouchableOpacity onPress={requestCustomerLocation}>
                <Text style={styles.locationRetry}>{locationSource === 'saved' ? 'طلب موقع جديد' : 'إعادة الطلب'}</Text>
              </TouchableOpacity>
            </View>
          ) : locationStatus === 'waiting' ? (
            <View style={styles.locationWaitingRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.locationWaitingText}>بانتظار موافقة العميل على مشاركة موقعه...</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.locationButton} onPress={requestCustomerLocation} disabled={locationStatus === 'sending'}>
              {locationStatus === 'sending' ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <>
                  <Ionicons name="location" size={16} color={colors.accent} />
                  <Text style={styles.locationButtonText}>إرسال رابط لتحديد موقع العميل</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {locationStatus === 'error' ? <Text style={styles.locationErrorText}>تعذر تأكيد الموقع، يمكنك المتابعة بالعنوان النصي.</Text> : null}
        </View>

        <Field label="قيمة الوجبة (ر.س)" value={mealAmount} onChangeText={setMealAmount} placeholder="0" keyboardType="numeric" />

        {needsManualDeliveryFee ? (
          <Field label="رسوم التوصيل (ر.س)" value={deliveryFee} onChangeText={setDeliveryFee} placeholder="0" keyboardType="numeric" />
        ) : isDistanceBasedFee ? (
          <View style={styles.autoFeeNote}>
            <Ionicons
              name={estimating ? 'time-outline' : feeEstimate ? 'checkmark-circle' : 'information-circle'}
              size={16}
              color={colors.success}
            />
            <View style={{ flex: 1 }}>
              {estimating ? (
                <Text style={styles.autoFeeText}>جاري حساب رسوم التوصيل حسب المسافة...</Text>
              ) : feeEstimate ? (
                <>
                  <Text style={styles.autoFeeText}>
                    رسوم التوصيل (على العميل): {feeEstimate.deliveryFee.toFixed(2)} ر.س — عن مسافة {feeEstimate.distanceKm.toFixed(1)} كم.
                  </Text>
                  {typeof feeEstimate.platformCommission === 'number' && feeEstimate.platformCommission > 0 ? (
                    <Text style={[styles.autoFeeText, { marginTop: 4 }]}>
                      عمولة الخدمة عليك: {feeEstimate.platformCommission.toFixed(2)} ر.س (تُخصم بالتسوية، لا تُضاف على العميل).
                    </Text>
                  ) : null}
                </>
              ) : estimateError ? (
                <Text style={styles.autoFeeText}>{estimateError}</Text>
              ) : (
                <Text style={styles.autoFeeText}>حدّد موقع العميل وقيمة الوجبة لعرض رسوم التوصيل المتوقعة.</Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.autoFeeNote}>
            <Ionicons name="information-circle" size={16} color={colors.success} />
            <Text style={styles.autoFeeText}>
              {restaurant.deliveryFeePolicy === 'fixed'
                ? `رسوم التوصيل ثابتة${restaurant.deliveryFeeValue ? ` عند ${restaurant.deliveryFeeValue} ر.س` : ''} وتُحسب تلقائيًا.`
                : restaurant.deliveryFeePolicy === 'percentage'
                ? `رسوم التوصيل ${restaurant.deliveryFeeValue ?? 0}% من قيمة الوجبة${
                    Number(mealAmount) > 0
                      ? ` — بقيمة ${((Number(mealAmount) * (restaurant.deliveryFeeValue ?? 0)) / 100).toFixed(1)} ر.س تقريبًا`
                      : ''
                  }، وتُحسب تلقائيًا.`
                : 'رسوم التوصيل تُحسب تلقائيًا حسب سياسة متجرك.'}
            </Text>
          </View>
        )}

        <Text style={styles.label}>طريقة الدفع</Text>
        <View style={styles.paymentRow}>
          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'cash' ? styles.paymentOptionActive : null]}
            onPress={() => setPaymentMethod('cash')}
          >
            <Text style={[styles.paymentOptionText, paymentMethod === 'cash' ? styles.paymentOptionTextActive : null]}>نقدي</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'pos' ? styles.paymentOptionActive : null]}
            onPress={() => setPaymentMethod('pos')}
          >
            <Text style={[styles.paymentOptionText, paymentMethod === 'pos' ? styles.paymentOptionTextActive : null]}>شبكة</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>طريقة التحصيل</Text>
        <View style={styles.settlementList}>
          {SETTLEMENT_OPTIONS.map((option) => {
            const active = settlementMode === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.settlementOption, active ? styles.settlementOptionActive : null]}
                onPress={() => setSettlementMode(option.value)}
                activeOpacity={0.75}
              >
                <View style={[styles.settlementIconWrap, active ? styles.settlementIconWrapActive : null]}>
                  <Ionicons name={option.icon} size={19} color={active ? '#fff' : colors.primary} />
                </View>
                <View style={styles.settlementTextWrap}>
                  <Text style={[styles.settlementOptionLabel, active ? styles.settlementOptionLabelActive : null]}>{option.label}</Text>
                  <Text style={[styles.settlementOptionDescription, active ? styles.settlementOptionDescriptionActive : null]}>{option.description}</Text>
                </View>
                <View style={[styles.settlementCheck, active ? styles.settlementCheckActive : null]}>
                  {active ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Field label="ملاحظات (اختياري)" value={notes} onChangeText={setNotes} placeholder="أي تفاصيل إضافية للسائق" multiline />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.submitButton} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>إنشاء الطلب</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline ? styles.inputMultiline : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14 },
  backButton: { flexDirection: 'row-reverse', alignItems: 'center', width: 60 },
  backText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  title: { fontSize: 18, fontWeight: '900', color: colors.text },
  form: { paddingHorizontal: 20, paddingBottom: 40 },
  foundHint: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: -8, marginBottom: 12 },
  foundHintText: { fontSize: 11.5, fontWeight: '700', color: colors.success, textAlign: 'right' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, textAlign: 'right', color: colors.text, backgroundColor: colors.card },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  autoFeeNote: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, backgroundColor: colors.successBg, borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.successBorder },
  autoFeeText: { flex: 1, color: colors.success, fontSize: 12, fontWeight: '700', textAlign: 'right', lineHeight: 18 },
  paymentRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 16 },
  paymentOption: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.card },
  paymentOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  paymentOptionText: { fontWeight: '800', color: colors.text, fontSize: 13 },
  paymentOptionTextActive: { color: '#fff' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '700', marginBottom: 12, textAlign: 'right' },
  submitButton: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  locationBox: { marginBottom: 16 },
  locationButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accentGlow, borderRadius: 14, paddingVertical: 13 },
  locationButtonText: { color: colors.accentDark, fontWeight: '800', fontSize: 13 },
  locationWaitingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: colors.accentTint, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.accentGlow },
  locationWaitingText: { color: colors.accentDark, fontWeight: '700', fontSize: 12, flexShrink: 1, textAlign: 'right' },
  locationConfirmed: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.successBg, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.successBorder },
  locationConfirmedRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  locationConfirmedText: { color: colors.success, fontWeight: '800', fontSize: 12 },
  locationRetry: { color: colors.subtext, fontWeight: '700', fontSize: 11, textDecorationLine: 'underline' },
  locationErrorText: { color: colors.danger, fontSize: 11, fontWeight: '700', textAlign: 'right', marginTop: 6 },
  settlementList: { gap: spacing.sm + 2, marginBottom: 16 },
  settlementOption: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm + 2,
    backgroundColor: colors.card,
    ...tintedShadow(colors.text, 0.03),
  },
  settlementOptionActive: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  settlementIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementIconWrapActive: { backgroundColor: colors.primary },
  settlementTextWrap: { flex: 1 },
  settlementOptionLabel: { fontWeight: '900', color: colors.text, fontSize: 13.5, textAlign: 'right' },
  settlementOptionLabelActive: { color: colors.primaryDark },
  settlementOptionDescription: { color: colors.subtext, fontSize: 11, fontWeight: '600', textAlign: 'right', marginTop: 3, lineHeight: 16 },
  settlementOptionDescriptionActive: { color: colors.primaryDark, opacity: 0.8 },
  settlementCheck: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementCheckActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
