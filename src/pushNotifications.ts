import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// يتطلب توليد توكن Expo Push مشروعًا مربوطًا بـ EAS (يملك projectId) — بدونه نتجاهل التسجيل بصمت
// بدل ما نكسر تدفق تسجيل الدخول، لأن الإشعارات ميزة إضافية وليست حرجة لعمل التطبيق.
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS === 'android') {
    // أعلى أهمية حتى يظهر إشعار تحديث الطلب منبثقًا مع صوت بدل ما ينزل بالدرج بصمت.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;

  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    return result.data;
  } catch {
    return null;
  }
}

// يستدعي onActivity كلما وصل إشعار والتطبيق مفتوح، أو ضغط المستخدم على إشعار — حتى تُحدَّث الطلبات
// فورًا بدل انتظار دورة السحب التالية. يعيد دالة لإلغاء الاشتراك.
export function subscribeToPushActivity(onActivity: () => void): () => void {
  const received = Notifications.addNotificationReceivedListener(() => onActivity());
  const responded = Notifications.addNotificationResponseReceivedListener(() => onActivity());
  return () => {
    received.remove();
    responded.remove();
  };
}
