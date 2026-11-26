import * as SecureStore from 'expo-secure-store';

export const API_BASE_URL = 'http://72.60.95.121/api';

const TOKEN_KEY = 'wasla_restaurant_token';

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

const ONBOARDING_KEY = 'wasla_restaurant_onboarding_seen';

export async function hasSeenOnboarding(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === '1';
}

export async function markOnboardingSeen() {
  await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
}

export type RestaurantFee = {
  id: string;
  type: string;
  amount: number;
  cadence: 'once' | 'weekly' | 'monthly';
  startDate: string;
  isActive: boolean;
  createdAt: string;
  justification?: string;
  justificationSubmittedAt?: string;
  justificationStatus?: 'pending' | 'approved' | 'rejected';
  justificationDecisionAt?: string;
  justificationDecisionNote?: string;
};

export type RestaurantDocument = {
  type: string;
  label: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'missing';
  fileUrl: string | null;
  fileName: string | null;
  expiryDate: string | null;
  uploadedAt: string | null;
  daysLeft: number | null;
};

export type Restaurant = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  businessType?: string;
  deliveryFeePolicy?: 'fixed' | 'percentage' | 'manual' | 'distance';
  deliveryFeePolicyName?: string;
  deliveryFeeValue?: number;
  deliveryFlagFee?: number;
  deliveryPerKmRate?: number;
  deliveryServicePercent?: number;
  complianceSuspended?: boolean;
  complianceSuspensionReason?: string | null;
  complianceExpiringSoonCount?: number;
  documents?: RestaurantDocument[];
  recurringFees?: RestaurantFee[];
  maxCancellationsAllowed?: number;
  cancellationPenaltyAmount?: number;
  createdAt?: string;
};

export type Order = {
  id: string;
  orderNumber?: string;
  customerName: string;
  phone: string;
  area: string;
  address: string;
  mealAmount: number;
  deliveryFee: number;
  collectedAmount?: number;
  courierId?: string;
  courierName?: string;
  status: string;
  statusName?: string;
  paymentMethod?: string;
  paymentMethodName?: string;
  notes?: string;
  cancelReason?: string;
  deliveryFailureReason?: string;
  returnReason?: string;
  createdAt: string;
  preparationReadyAt?: string;
  readyForPickupAt?: string;
  assignedAt?: string;
  courierAcceptedAt?: string;
  handedToCourierAt?: string;
  pickedUpAt?: string;
  tripStartedAt?: string;
  onTheWayAt?: string;
  deliveredAt?: string;
  closedAt?: string;
  cancelledAt?: string;
  deliveryFailedAt?: string;
  returnedAt?: string;
  pickupProofUri?: string;
  deliveryProofUri?: string;
  courierRating?: number;
  courierRatedAt?: string;
};

export type CourierInfo = {
  id: string;
  name: string;
  phone: string | null;
  vehicleType: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlateNumber: string | null;
  courierPhotoUrl: string | null;
  isOnline: boolean;
  distanceKm: number | null;
  estimatedArrivalMinutes: number | null;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(body?.message || 'حدث خطأ غير متوقع، حاول مرة أخرى.', response.status);
  }

  return body as T;
}

export async function loginRestaurant(identifier: string, password: string) {
  return request<{ token: string; restaurant: Restaurant }>('/mobile/restaurant/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export async function fetchMe(token: string) {
  return request<Restaurant>('/mobile/restaurant/me', {}, token);
}

export async function registerPushToken(token: string, expoPushToken: string) {
  return request<{ ok: boolean }>('/mobile/restaurant/push-token', {
    method: 'POST',
    body: JSON.stringify({ expoPushToken }),
  }, token);
}

export type RestaurantAnalytics = {
  fromDays: number;
  totalOrders: number;
  closedOrders: number;
  cancelledOrders: number;
  avgActualPrepMinutes: number;
  avgPromisedPrepMinutes: number;
  onTimeRate: number;
  prepSamplesCount: number;
  hourlyOrderCounts: number[];
};

export async function fetchAnalytics(token: string, days: number) {
  return request<RestaurantAnalytics>(`/mobile/restaurant/analytics?days=${days}`, {}, token);
}

export async function fetchOrders(token: string) {
  return request<Order[]>('/mobile/restaurant/orders', {}, token);
}

export type CustomerLookupResult = {
  customerName: string;
  phone: string;
  area: string;
  address: string;
  mapLink?: string;
  customerLatitude?: number;
  customerLongitude?: number;
  ordersCount: number;
};

export async function lookupCustomerByPhone(token: string, phone: string): Promise<CustomerLookupResult | null> {
  try {
    return await request<CustomerLookupResult>(`/mobile/restaurant/customers/lookup?phone=${encodeURIComponent(phone)}`, {}, token);
  } catch (err: any) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export type DeliveryFeeEstimate = {
  deliveryFee: number;
  platformCommission?: number;
  distanceKm: number;
  deliveryFeeType: string;
};

export async function estimateDeliveryFee(
  token: string,
  input: { mealAmount: number; customerLatitude: number; customerLongitude: number },
) {
  return request<DeliveryFeeEstimate>('/mobile/restaurant/orders/estimate-delivery-fee', {
    method: 'POST',
    body: JSON.stringify(input),
  }, token);
}

export async function fetchOrder(token: string, orderId: string) {
  return request<Order>(`/mobile/restaurant/orders/${orderId}`, {}, token);
}

export async function fetchOrderCourier(token: string, orderId: string) {
  return request<CourierInfo>(`/mobile/restaurant/orders/${orderId}/courier`, {}, token);
}

export async function rateCourier(token: string, orderId: string, rating: number) {
  return request<Order>(`/mobile/restaurant/orders/${orderId}/rate-courier`, {
    method: 'PATCH',
    body: JSON.stringify({ rating }),
  }, token);
}

export async function submitFeeJustification(token: string, feeId: string, justification: string) {
  return request<RestaurantFee>(`/mobile/restaurant/fees/${feeId}/justification`, {
    method: 'POST',
    body: JSON.stringify({ justification }),
  }, token);
}

export async function markOrderReady(token: string, orderId: string) {
  return request<Order>(`/mobile/restaurant/orders/${orderId}/ready`, { method: 'PATCH', body: '{}' }, token);
}

export async function cancelOrder(token: string, orderId: string, reason?: string) {
  return request<Order>(`/mobile/restaurant/orders/${orderId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  }, token);
}

export type CreateOrderInput = {
  customerName: string;
  phone: string;
  area: string;
  address: string;
  mealAmount: number;
  deliveryFee: number;
  prepMinutes: number;
  paymentMethod: 'cash' | 'pos';
  settlementMode: 'customer_prepaid' | 'courier_advances' | 'courier_collects';
  notes?: string;
  mapLink?: string;
  customerLatitude?: number;
  customerLongitude?: number;
  locationMethod?: 'map-picker' | 'map-link' | 'manual';
};

// restaurantName مطلوب في جسم الطلب، فنرسل اسم المتجر الحقيقي بدل نص وهمي — حتى لو اعتمد الخادم
// على القيمة المرسلة لا يظهر للسائق اسم متجر خاطئ.
export async function createOrder(token: string, input: CreateOrderInput, restaurantName: string) {
  return request<Order>('/mobile/restaurant/orders', {
    method: 'POST',
    body: JSON.stringify({ ...input, restaurantName }),
  }, token);
}

export type LocationRequest = {
  token: string;
  status: 'pending' | 'resolved';
  latitude?: number;
  longitude?: number;
  accuracy?: number;
};

export async function createLocationRequest(token: string) {
  return request<{ token: string; shareUrl: string }>('/mobile/restaurant/location-requests', { method: 'POST', body: '{}' }, token);
}

export async function pollLocationRequest(token: string, requestToken: string) {
  return request<LocationRequest>(`/mobile/restaurant/location-requests/${requestToken}`, {}, token);
}

export type PendingSettlement = {
  restaurantId: string;
  restaurantName: string;
  ordersCount: number;
  totalMealValue: number;
  deliveryFeeDebt: number;
  mealOwedToRestaurant: number;
  netAmount: number;
  direction: 'restaurant_owes' | 'admin_owes' | 'settled';
  recurringFees: RestaurantFee[];
  orders: {
    id: string;
    orderNumber?: string;
    customerName: string;
    settlementMode: string;
    mealAmount: number;
    deliveryFee: number;
    closedAt?: string;
  }[];
};

export type SettlementRecord = {
  id: string;
  orderIds: string[];
  ordersCount: number;
  totalMealValue: number;
  deliveryFeeDebt: number;
  feesCharged: number;
  netAmount: number;
  direction: 'restaurant_owes' | 'admin_owes' | 'settled';
  amountSettled: number;
  notes?: string;
  settledBy?: string;
  createdAt: string;
};

export async function fetchPendingSettlement(token: string) {
  return request<PendingSettlement>('/mobile/restaurant/settlement', {}, token);
}

export async function fetchSettlementHistory(token: string) {
  return request<SettlementRecord[]>('/mobile/restaurant/settlement-history', {}, token);
}

export type StatementEntry = {
  date: string;
  type: 'order_net' | 'settlement_payment' | 'service_commission';
  label: string;
  description: string;
  orderId?: string;
  orderNumber?: string;
  amount: number;
  runningBalance: number;
};

export type RestaurantStatement = {
  restaurantId: string;
  restaurantName: string;
  openingBalance: number;
  closingBalance: number;
  entries: StatementEntry[];
};

export type SupportMessage = {
  id: string;
  restaurantId?: string;
  senderType: 'restaurant' | 'admin';
  senderName?: string;
  text: string;
  createdAt: string;
};

export async function fetchSupportMessages(token: string) {
  return request<SupportMessage[]>('/mobile/restaurant/support/messages', {}, token);
}

export async function sendSupportMessage(token: string, text: string) {
  return request<SupportMessage>('/mobile/restaurant/support/messages', {
    method: 'POST',
    body: JSON.stringify({ text }),
  }, token);
}

export async function fetchStatement(token: string, fromDays: number) {
  const from = new Date(Date.now() - fromDays * 24 * 60 * 60 * 1000).toISOString();
  return request<RestaurantStatement>(`/mobile/restaurant/statement?from=${encodeURIComponent(from)}`, {}, token);
}
