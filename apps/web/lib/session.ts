'use client';

/**
 * نشستِ سمتِ مرورگر.
 *
 * توکن در `localStorage` می‌نشیند و با هدرِ `Authorization` فرستاده می‌شود،
 * نه در کوکی — چون در توسعهٔ لوکال وب روی ۳۱۰۰ و API روی ۳۲۰۰ است و
 * کوکیِ cross-origin دردسرِ بی‌دلیل می‌شود. روزی که ورود سخت‌گیرانه شد،
 * کوکیِ httpOnly جایگزینِ درست است.
 */

const TOKEN_KEY = 'flowstudio_token';
const PHONE_KEY = 'flowstudio_phone';

/**
 * لوکال: API روی پورتِ جدا (۳۲۰۰). روی سرور: nginx مسیرِ /api را می‌فرستد
 * ⇒ same-origin.
 */
export function apiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3200';
  }
  return '';
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getPhone(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(PHONE_KEY);
}

export function saveSession(token: string, phone: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(PHONE_KEY, phone);
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(PHONE_KEY);
}

/** `fetch` با توکن. ۴۰۱ ⇒ نشست پاک می‌شود تا صفحه به ورود برگردد. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${apiBase()}${path}`, { ...init, headers });
  if (res.status === 401) clearSession();
  return res;
}

/** شمارهٔ `+989123456789` را برایِ نمایش به `۰۹۱۲۳۴۵۶۷۸۹` برمی‌گرداند. */
export function displayPhone(phone: string | null): string {
  if (!phone) return '';
  return phone.startsWith('+98') ? `0${phone.slice(3)}` : phone;
}
