import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, tintedShadow } from '../theme';

type Props = {
  onLogin: (identifier: string, password: string) => Promise<void>;
};

export default function LoginScreen({ onLogin }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const identifierRef = useRef('');
  const passwordRef = useRef('');
  identifierRef.current = identifier;
  passwordRef.current = password;

  const submit = useCallback(async () => {
    const currentIdentifier = identifierRef.current;
    const currentPassword = passwordRef.current;
    if (!currentIdentifier.trim() || !currentPassword.trim()) {
      setError('يرجى إدخال البريد الإلكتروني أو رقم الهاتف وكلمة المرور.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onLogin(currentIdentifier.trim(), currentPassword);
    } catch (err: any) {
      setError(err?.message || 'تعذر تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  }, [onLogin]);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logoRing}>
            <View style={styles.logoCircle}>
              <Ionicons name="storefront" size={34} color={colors.primary} />
            </View>
          </View>
          <Text style={styles.heroTitle}>متاجر وصلة</Text>
          <Text style={styles.heroSubtitle}>سجّل دخولك لإدارة طلبات متجرك مباشرة من هاتفك</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHandle} />

          <Text style={styles.label}>البريد الإلكتروني أو رقم الهاتف</Text>
          <View style={[styles.inputWrap, identifierFocused ? styles.inputWrapFocused : null]}>
            <View style={[styles.inputIconWrap, identifierFocused ? styles.inputIconWrapActive : null]}>
              <Ionicons name="person-outline" size={17} color={identifierFocused ? colors.primary : colors.subtext} />
            </View>
            <TextInput
              style={styles.input}
              value={identifier}
              onChangeText={setIdentifier}
              onFocus={() => setIdentifierFocused(true)}
              onBlur={() => setIdentifierFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="example@wasla.demo"
              placeholderTextColor={colors.muted}
            />
          </View>

          <Text style={[styles.label, styles.labelSpaced]}>كلمة المرور</Text>
          <View style={[styles.inputWrap, passwordFocused ? styles.inputWrapFocused : null]}>
            <View style={[styles.inputIconWrap, passwordFocused ? styles.inputIconWrapActive : null]}>
              <Ionicons name="lock-closed-outline" size={17} color={passwordFocused ? colors.primary : colors.subtext} />
            </View>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.eyeButton}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.subtext} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity onPress={submit} disabled={loading} activeOpacity={0.88} style={styles.button}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.buttonText}>تسجيل الدخول</Text>
                <Ionicons name="arrow-back" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>

        </View>

        <Text style={styles.perksTitle}>ليش متاجر وصلة؟</Text>
        <View style={styles.perksRow}>
          <View style={[styles.perk, { borderColor: colors.primaryGlow }]}>
            <View style={[styles.perkIcon, { backgroundColor: colors.primaryTint }]}>
              <Ionicons name="fast-food" size={20} color={colors.primary} />
            </View>
            <Text style={styles.perkLabel}>طلبات فورية</Text>
          </View>
          <View style={[styles.perk, { borderColor: colors.accentGlow }]}>
            <View style={[styles.perkIcon, { backgroundColor: colors.accentTint }]}>
              <Ionicons name="wallet" size={20} color={colors.accent} />
            </View>
            <Text style={styles.perkLabel}>تحصيل موثوق</Text>
          </View>
          <View style={[styles.perk, { borderColor: colors.successBorder }]}>
            <View style={[styles.perkIcon, { backgroundColor: colors.successBg }]}>
              <Ionicons name="headset" size={20} color={colors.success} />
            </View>
            <Text style={styles.perkLabel}>دعم متواصل</Text>
          </View>
        </View>

        <Text style={styles.footerText}>جميع الحقوق محفوظة لشركة روائس</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primary },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl, backgroundColor: colors.bg },

  hero: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 76 : 56,
    paddingBottom: 56,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  logoRing: {
    width: 92, height: 92, borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  logoCircle: {
    width: 68, height: 68, borderRadius: radius.pill, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    ...tintedShadow('#000', 0.3),
  },
  heroTitle: { fontSize: 27, fontWeight: '900', color: '#fff', marginBottom: 8 },
  heroSubtitle: { fontSize: 13.5, color: 'rgba(255,255,255,0.88)', textAlign: 'center', lineHeight: 21, fontWeight: '600', maxWidth: 270 },

  card: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    marginTop: -36,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    alignItems: 'stretch',
    ...tintedShadow('#000', 0.18),
  },
  cardHandle: {
    width: 40, height: 4, borderRadius: 999, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  label: { fontSize: 12.5, fontWeight: '800', color: colors.text, marginBottom: spacing.xs, textAlign: 'right' },
  labelSpaced: { marginTop: spacing.md },

  inputWrap: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, backgroundColor: colors.neutralTint,
  },
  inputWrapFocused: { borderColor: colors.primary, backgroundColor: colors.card },
  inputIconWrap: {
    width: 34, height: 34, borderRadius: radius.sm, backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  inputIconWrapActive: { backgroundColor: colors.primaryTint },
  input: { flex: 1, paddingVertical: 8, fontSize: 15, color: colors.text, fontWeight: '600' },
  eyeButton: { padding: 4 },

  errorBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  error: { color: colors.danger, fontSize: 12.5, fontWeight: '700', textAlign: 'right', flex: 1 },

  button: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, marginTop: spacing.lg,
    ...tintedShadow(colors.primary, 0.35),
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  perksTitle: {
    fontSize: 13, fontWeight: '800', color: colors.text, textAlign: 'center',
    marginTop: spacing.xl, marginBottom: spacing.sm,
  },
  perksRow: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg },
  perk: {
    flex: 1, alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1,
    paddingVertical: spacing.md, paddingHorizontal: 6,
    ...tintedShadow('#000', 0.06),
  },
  perkIcon: {
    width: 46, height: 46, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  perkLabel: { fontSize: 11, fontWeight: '800', color: colors.text, textAlign: 'center' },

  footerText: {
    fontSize: 11.5, fontWeight: '600', color: colors.muted,
    textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg,
  },
});
