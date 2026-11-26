import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, StyleSheet, View } from 'react-native';

import {
  ApiError,
  cancelOrder as apiCancelOrder,
  clearToken,
  createOrder,
  fetchMe,
  fetchOrders,
  fetchPendingSettlement,
  fetchSettlementHistory,
  getToken,
  hasSeenOnboarding,
  loginRestaurant,
  markOnboardingSeen,
  markOrderReady as apiMarkOrderReady,
  rateCourier as apiRateCourier,
  registerPushToken,
  saveToken,
} from './src/api';
import type { CreateOrderInput, Order, PendingSettlement, Restaurant, SettlementRecord } from './src/api';
import { colors } from './src/theme';
import { getPushToken, subscribeToPushActivity } from './src/pushNotifications';

import LoginScreen from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import OrdersListScreen from './src/screens/OrdersListScreen';
import ViolationsScreen from './src/screens/ViolationsScreen';
import CollectionsScreen from './src/screens/CollectionsScreen';
import CreateOrderScreen from './src/screens/CreateOrderScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import OrderSuccessScreen from './src/screens/OrderSuccessScreen';
import RestaurantProfileScreen from './src/screens/RestaurantProfileScreen';
import SupportScreen from './src/screens/SupportScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import TabBar, { TabKey } from './src/components/TabBar';

type OverlayScreen = 'create' | 'detail' | 'success' | 'profile' | 'support' | 'analytics' | null;

// حالة الطلب تتغير من جهة السائق والإدارة (إسناد، قبول، استلام، تسليم)، فتُسحب الطلبات دوريًا وعلى
// كل الشاشات. البيانات المالية والحساب أقل استعجالًا فتُسحب على فترة أطول.
const ORDERS_POLL_MS = 10000;
const ACCOUNT_POLL_MS = 60000;

export default function App() {
  const [booting, setBooting] = useState(true);
  const [onboardingSeen, setOnboardingSeen] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingSettlement, setPendingSettlement] = useState<PendingSettlement | null>(null);
  const [settlementHistory, setSettlementHistory] = useState<SettlementRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [overlay, setOverlay] = useState<OverlayScreen>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<Order | null>(null);

  // نسخ مرجعية من الحالة تُقرأ داخل دوال السحب الدوري دون إعادة إنشائها مع كل تغيّر.
  const selectedOrderRef = useRef<Order | null>(null);
  const overlayRef = useRef<OverlayScreen>(null);
  selectedOrderRef.current = selectedOrder;
  overlayRef.current = overlay;

  // رقم تسلسلي لكل سحب للطلبات: أي رد قديم يصل بعد تعديل محلي أحدث منه يُهمل بدل ما يكتب فوقه.
  const ordersSeq = useRef(0);
  const ordersRefreshBusy = useRef(false);

  const loadOrders = useCallback(async (activeToken: string) => {
    const seq = ++ordersSeq.current;
    const result = await fetchOrders(activeToken);
    if (seq !== ordersSeq.current) return;
    setOrders(result);

    // شاشة تفاصيل الطلب وشاشة "تم إنشاء الطلب" تعرضان نسخة من الطلب، فتُحدَّثان هنا مع كل سحب —
    // بدون ذلك تبقى الشاشة على "بانتظار إسناد سائق" مهما تغيّر الطلب فعليًا.
    setLastCreatedOrder((current) => (current ? result.find((item) => item.id === current.id) ?? current : current));
    const selected = selectedOrderRef.current;
    if (selected) {
      const fresh = result.find((item) => item.id === selected.id);
      if (fresh) {
        setSelectedOrder(fresh);
      } else if (overlayRef.current === 'detail') {
        setOverlay(null);
        setSelectedOrder(null);
        Alert.alert('الطلب لم يعد موجودًا', `الطلب ${selected.orderNumber || selected.id} حُذف من النظام.`);
      }
    }
  }, []);

  const loadAccount = useCallback(async (activeToken: string) => {
    const [me, settlement, history] = await Promise.all([
      fetchMe(activeToken),
      fetchPendingSettlement(activeToken),
      fetchSettlementHistory(activeToken),
    ]);
    setRestaurant(me);
    setPendingSettlement(settlement);
    setSettlementHistory(history);
  }, []);

  const loadEverything = useCallback(async (activeToken: string) => {
    await loadAccount(activeToken);
    await loadOrders(activeToken);
  }, [loadAccount, loadOrders]);

  const performLogout = useCallback(async () => {
    await clearToken();
    ordersSeq.current += 1;
    setToken(null);
    setRestaurant(null);
    setOrders([]);
    setPendingSettlement(null);
    setSettlementHistory([]);
    setSelectedOrder(null);
    setLastCreatedOrder(null);
    setActiveTab('home');
    setOverlay(null);
  }, []);

  // أخطاء السحب الدوري العابرة تُتجاهل وتبقى آخر بيانات محمّلة، إلا انتهاء/إلغاء الجلسة (401):
  // بدون هذا يبقى المتجر "داخلًا" على بيانات قديمة للأبد.
  const handleRefreshError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      performLogout().then(() => {
        Alert.alert('انتهت الجلسة', 'يرجى تسجيل الدخول من جديد.');
      });
    }
  }, [performLogout]);

  const refreshOrdersNow = useCallback(() => {
    if (!token || ordersRefreshBusy.current) return;
    ordersRefreshBusy.current = true;
    loadOrders(token)
      .catch(handleRefreshError)
      .finally(() => {
        ordersRefreshBusy.current = false;
      });
  }, [token, loadOrders, handleRefreshError]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') refreshOrdersNow();
    }, ORDERS_POLL_MS);
    return () => clearInterval(interval);
  }, [token, refreshOrdersNow]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') loadAccount(token).catch(handleRefreshError);
    }, ACCOUNT_POLL_MS);
    return () => clearInterval(interval);
  }, [token, loadAccount, handleRefreshError]);

  // تحديث فوري كل مرة يرجع فيها التطبيق من الخلفية.
  useEffect(() => {
    if (!token) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadEverything(token).catch(handleRefreshError);
    });
    return () => subscription.remove();
  }, [token, loadEverything, handleRefreshError]);

  // أي إشعار يصل والتطبيق مفتوح (أو يُضغط عليه) يحدّث الطلبات فورًا بدل انتظار السحب التالي.
  useEffect(() => {
    if (!token) return;
    return subscribeToPushActivity(refreshOrdersNow);
  }, [token, refreshOrdersNow]);

  useEffect(() => {
    (async () => {
      const seen = await hasSeenOnboarding();
      setOnboardingSeen(seen);
      const stored = await getToken();
      if (stored) {
        try {
          await loadEverything(stored);
          setToken(stored);
        } catch {
          await clearToken();
        }
      }
      setBooting(false);
    })();
  }, [loadEverything]);

  // تسجيل توكن الإشعارات الفورية — يفشل بصمت إذا لم يكن المشروع مربوطًا بـ EAS أو رُفضت الصلاحية،
  // لأن الإشعارات ميزة إضافية ولا يجب أن توقف تسجيل الدخول.
  useEffect(() => {
    if (!token) return;
    (async () => {
      const pushToken = await getPushToken();
      if (pushToken) {
        registerPushToken(token, pushToken).catch(() => {});
      }
    })();
  }, [token]);

  const handleLogin = async (identifier: string, password: string) => {
    const result = await loginRestaurant(identifier, password);
    await saveToken(result.token);
    setToken(result.token);
    setRestaurant(result.restaurant);
    await loadOrders(result.token);
    try {
      const [settlement, history] = await Promise.all([
        fetchPendingSettlement(result.token),
        fetchSettlementHistory(result.token),
      ]);
      setPendingSettlement(settlement);
      setSettlementHistory(history);
    } catch {
      // البيانات المالية ثانوية عند الدخول، لا نمنع تسجيل الدخول لو فشل جلبها
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل تريد تسجيل الخروج من التطبيق؟',
      [
        { text: 'لا', style: 'cancel' },
        { text: 'نعم', style: 'destructive', onPress: () => { performLogout(); } },
      ],
    );
  };

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await loadEverything(token);
    } catch (err) {
      // تجاهل أخطاء التحديث العابرة، تبقى آخر بيانات محمّلة
      handleRefreshError(err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateOrder = async (input: CreateOrderInput) => {
    if (!token || !restaurant) return;
    const created = await createOrder(token, input, restaurant.name);
    ordersSeq.current += 1;
    setOrders((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    setLastCreatedOrder(created);
    setOverlay('success');
  };

  const applyOrderUpdate = (updated: Order) => {
    ordersSeq.current += 1;
    setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedOrder((current) => (current && current.id === updated.id ? updated : current));
  };

  const handleMarkOrderReady = async (orderId: string) => {
    if (!token) return;
    const updated = await apiMarkOrderReady(token, orderId);
    applyOrderUpdate(updated);
  };

  const handleCancelOrder = async (orderId: string, reason: string) => {
    if (!token) return;
    const updated = await apiCancelOrder(token, orderId, reason);
    applyOrderUpdate(updated);
  };

  const handleRateCourier = async (orderId: string, rating: number) => {
    if (!token) return;
    const updated = await apiRateCourier(token, orderId, rating);
    applyOrderUpdate(updated);
  };

  if (booting) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!onboardingSeen) {
    return (
      <OnboardingScreen
        onFinish={() => {
          markOnboardingSeen().catch(() => {});
          setOnboardingSeen(true);
        }}
      />
    );
  }

  if (!token || !restaurant) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (overlay === 'create') {
    return (
      <CreateOrderScreen
        restaurant={restaurant}
        token={token}
        onBack={() => setOverlay(null)}
        onSubmit={handleCreateOrder}
      />
    );
  }

  if (overlay === 'detail' && selectedOrder) {
    return (
      <OrderDetailScreen
        order={selectedOrder}
        token={token}
        onBack={() => setOverlay(null)}
        onMarkReady={handleMarkOrderReady}
        onCancel={handleCancelOrder}
        onRateCourier={handleRateCourier}
      />
    );
  }

  if (overlay === 'success' && lastCreatedOrder) {
    return (
      <OrderSuccessScreen
        order={lastCreatedOrder}
        onViewOrder={() => {
          setSelectedOrder(lastCreatedOrder);
          setOverlay('detail');
        }}
        onCreateAnother={() => setOverlay('create')}
        onDone={() => {
          setOverlay(null);
          setActiveTab('home');
        }}
      />
    );
  }

  if (overlay === 'profile') {
    return (
      <RestaurantProfileScreen
        restaurant={restaurant}
        onBack={() => setOverlay(null)}
        onOpenSupport={() => setOverlay('support')}
        onOpenAnalytics={() => setOverlay('analytics')}
      />
    );
  }

  if (overlay === 'support') {
    return <SupportScreen token={token} onBack={() => setOverlay('profile')} />;
  }

  if (overlay === 'analytics') {
    return <AnalyticsScreen token={token} onBack={() => setOverlay('profile')} />;
  }

  const openOrder = (order: Order) => {
    setSelectedOrder(order);
    setOverlay('detail');
  };

  const markReadyFromList = (orderId: string) => {
    handleMarkOrderReady(orderId).catch((err) => Alert.alert('تعذر التنفيذ', err?.message || 'حاول مرة أخرى.'));
  };

  const violationsCount = (restaurant.recurringFees ?? []).filter((fee) => fee.isActive).length;

  return (
    <View style={styles.appShell}>
      <View style={styles.content}>
        {activeTab === 'home' && (
          <HomeScreen
            restaurant={restaurant}
            orders={orders}
            pendingSettlement={pendingSettlement}
            onCreateOrder={() => setOverlay('create')}
            onNavigate={setActiveTab}
            onOpenProfile={() => setOverlay('profile')}
            onOpenOrder={openOrder}
            onLogout={handleLogout}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersListScreen
            orders={orders}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onOpenOrder={openOrder}
            onMarkReady={markReadyFromList}
            onCreateOrder={() => setOverlay('create')}
          />
        )}
        {activeTab === 'violations' && (
          <ViolationsScreen restaurant={restaurant} token={token} refreshing={refreshing} onRefresh={handleRefresh} />
        )}
        {activeTab === 'collections' && (
          <CollectionsScreen
            pending={pendingSettlement}
            history={settlementHistory}
            orders={orders}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            token={token}
          />
        )}
      </View>
      <TabBar active={activeTab} onChange={setActiveTab} badges={{ violations: violationsCount || undefined }} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  appShell: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
});
