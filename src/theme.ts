export const colors = {
  bg: '#FBF7F5',
  card: '#FFFFFF',
  text: '#231B1A',
  textSoft: 'rgba(35,27,26,0.7)',
  subtext: '#8A7C79',
  border: '#F0E6E3',

  // كورال — اللون الأساسي الحماسي/المحفّز
  primary: '#FF6B54',
  primaryDark: '#E8543F',
  primaryTint: '#FFEEEA',
  primaryGlow: 'rgba(255,107,84,0.28)',

  // أزرق كهربائي — للرسوم البيانية والتمييز الثانوي
  accent: '#2E7DFF',
  accentDark: '#1D5FE0',
  accentTint: '#EAF1FF',
  accentGlow: 'rgba(46,125,255,0.25)',

  danger: '#E53E3E',
  dangerBg: '#FEECEC',
  dangerBorder: 'rgba(229,62,62,0.28)',
  success: '#22B07D',
  successBg: '#E9FBF3',
  successBorder: 'rgba(34,176,125,0.3)',
  warning: '#F2A93B',
  warningBg: '#FEF4E3',
  warningBorder: 'rgba(242,169,59,0.35)',
  muted: '#B8ACA9',
  neutralTint: '#F5EFED',
};

// نظام 8pt: كل قيم التباعد من هذا المقياس فقط.
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 };

// ظل ملوّن بلون العنصر نفسه بدل الرمادي الخام، حسب توصية 60/30/10.
export function tintedShadow(hexColor: string, opacity = 0.16) {
  return {
    shadowColor: hexColor,
    shadowOpacity: opacity,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  } as const;
}

export const statusMeta: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  new: { label: 'جديد', color: '#8A7C79', bg: '#F5EFED', icon: 'ellipse-outline' },
  accepted: { label: 'مقبول', color: colors.accent, bg: colors.accentTint, icon: 'checkmark-circle-outline' },
  preparing: { label: 'قيد التجهيز', color: colors.primary, bg: colors.primaryTint, icon: 'flame-outline' },
  readyForPickup: { label: 'جاهز للاستلام', color: '#8B5CF6', bg: '#F2EDFE', icon: 'bag-check-outline' },
  assigned: { label: 'مسند لسائق', color: colors.accent, bg: colors.accentTint, icon: 'person-outline' },
  pickedUp: { label: 'تم الاستلام', color: colors.accent, bg: colors.accentTint, icon: 'bicycle-outline' },
  onTheWay: { label: 'في الطريق', color: colors.primary, bg: colors.primaryTint, icon: 'navigate-outline' },
  delivered: { label: 'تم التسليم', color: colors.success, bg: colors.successBg, icon: 'checkmark-done-outline' },
  closed: { label: 'مغلق', color: colors.success, bg: colors.successBg, icon: 'checkmark-done-outline' },
  cancelled: { label: 'ملغي', color: colors.muted, bg: '#F5EFED', icon: 'close-circle-outline' },
  deliveryFailed: { label: 'فشل التوصيل', color: colors.danger, bg: colors.dangerBg, icon: 'alert-circle-outline' },
  returned: { label: 'مرتجع', color: colors.warning, bg: colors.warningBg, icon: 'return-up-back-outline' },
};

export function getStatusMeta(status: string) {
  return statusMeta[status] || { label: status, color: colors.subtext, bg: colors.bg, icon: 'ellipse-outline' };
}
