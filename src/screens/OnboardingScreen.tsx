import React, { useRef, useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';

type Props = {
  onFinish: () => void;
};

const { width } = Dimensions.get('window');

const SLIDES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'storefront',
    title: 'مرحبًا بك في متاجر وصلة',
    body: 'أنشئ طلبات التوصيل لعملائك بسهولة وسرعة، وتابع كل شيء من مكان واحد.',
  },
  {
    icon: 'add-circle',
    title: 'أنشئ طلبك بخطوات بسيطة',
    body: 'أدخل بيانات العميل وموقعه، وشاهد رسوم التوصيل المقدّرة فورًا قبل تأكيد الطلب.',
  },
  {
    icon: 'wallet',
    title: 'تابع تحصيلاتك',
    body: 'راقب مستحقاتك وتسوياتك المالية بشكل واضح من تبويب التحصيلات.',
  },
  {
    icon: 'stats-chart',
    title: 'حلّل أداء متجرك',
    body: 'شاهد وقت التجهيز الفعلي مقابل الموعود وساعات الذروة من تحليلات الأداء.',
  },
];

export default function OnboardingScreen({ onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLast = index === SLIDES.length - 1;

  const goToIndex = (next: number) => {
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(next);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <TouchableOpacity style={styles.skipButton} onPress={onFinish}>
        <Text style={styles.skipText}>تخطي</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide, slideIndex) => (
          <View key={slideIndex} style={[styles.slide, { width }]}>
            <View style={styles.iconWrap}>
              <Ionicons name={slide.icon} size={56} color={colors.primary} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, dotIndex) => (
            <View key={dotIndex} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity
          style={styles.nextButton}
          activeOpacity={0.88}
          onPress={() => (isLast ? onFinish() : goToIndex(index + 1))}
        >
          <Text style={styles.nextButtonText}>{isLast ? 'ابدأ الآن' : 'التالي'}</Text>
          {!isLast ? <Ionicons name="arrow-back" size={18} color="#fff" /> : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  skipButton: { position: 'absolute', top: 56, left: 20, zIndex: 1, padding: 8 },
  skipText: { color: colors.subtext, fontWeight: '800', fontSize: 13 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  body: { fontSize: 13.5, fontWeight: '600', color: colors.subtext, textAlign: 'center', lineHeight: 22 },
  footer: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 10 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 22 },
  nextButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
  },
  nextButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
