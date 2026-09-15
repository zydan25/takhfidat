import type { Product, Category, Banner, TrendCampaign, PricingSettings, Order, User, StoreSettings } from './types';
import { initialStoreSettings } from './types';
import { initialPricingSettings } from './utils/pricing';

const API_BASE_URL = (
  (((import.meta as any).env?.VITE_API_BASE_URL as string) || (import.meta as any).env?.PROD ? 'https://whats.alattab.site' : '')
).replace(/\/$/, '');
const TOKEN_KEY = 'takhfid_access_token';

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearAccessToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `967${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('7')) digits = `967${digits}`;
  return digits;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (err) {
    // Fallback to direct URL if a relative API call fails during local development.
    if (!API_BASE_URL && path.startsWith('/takhfid')) {
      const directUrl = `https://whats.alattab.site${path}`;
      response = await fetch(directUrl, { ...init, headers });
    } else {
      throw err;
    }
  }

  const data = (await response.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(data.error || data.message || `خطأ في الخادم (${response.status})`);
  }
  return data;
}

export interface ApiUser {
  uid: string;
  phone: string;
  firstName?: string;
  secondName?: string;
  thirdName?: string;
  lastName?: string;
  governorate?: string;
  role?: 'admin' | 'customer';
  isAdmin?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  updatedAt?: string;
}

export interface VerifySessionResponse {
  success: boolean;
  needsProfile?: boolean;
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  user: ApiUser;
}

// ================= AUTHENTICATION =================

export async function sendOtpApi(phoneNumber: string) {
  const cleanPhone = normalizePhone(phoneNumber);
  return apiFetch<{
    success: boolean;
    expiresInSeconds: number;
    retryAfterSeconds: number;
    phoneNumber: string;
  }>('/takhfid/api/v4/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber: cleanPhone }),
  });
}

export async function verifyOtpApi(payload: {
  phoneNumber: string;
  otp: string;
  firstName: string;
  secondName?: string;
  thirdName?: string;
  lastName?: string;
  governorate: string;
}): Promise<VerifySessionResponse> {
  const cleanPayload = {
    ...payload,
    phoneNumber: normalizePhone(payload.phoneNumber),
  };

  const result = await apiFetch<VerifySessionResponse>('/takhfid/api/v4/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(cleanPayload),
  });

  if (result.accessToken) {
    setAccessToken(result.accessToken);
  }

  if (result.needsProfile) {
    const profile = await apiFetch<{ success: boolean; user: ApiUser }>('/takhfid/api/v4/auth/complete-profile', {
      method: 'POST',
      body: JSON.stringify({
        firstName: cleanPayload.firstName?.trim() || 'عميل',
        secondName: cleanPayload.secondName?.trim() || undefined,
        thirdName: cleanPayload.thirdName?.trim() || undefined,
        lastName: cleanPayload.lastName?.trim() || undefined,
        governorate: cleanPayload.governorate?.trim() || 'أمانة العاصمة',
      }),
    });

    if (profile.user) {
      result.user = profile.user;
      result.needsProfile = false;
    }
  }

  return result;
}

export async function completeProfileApi(payload: {
  firstName: string;
  secondName?: string;
  thirdName?: string;
  lastName?: string;
  governorate: string;
}): Promise<ApiUser> {
  const result = await apiFetch<{ success: boolean; user: ApiUser }>('/takhfid/api/v4/auth/complete-profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.user;
}

export async function fetchCurrentUser(): Promise<ApiUser | null> {
  if (!getAccessToken()) return null;
  try {
    const result = await apiFetch<{ success: boolean; user: ApiUser }>('/takhfid/api/v4/auth/me');
    return result.user;
  } catch {
    clearAccessToken();
    return null;
  }
}