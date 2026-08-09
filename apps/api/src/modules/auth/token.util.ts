import { createHmac, timingSafeEqual } from 'crypto';

/**
 * توکنِ نشستِ بدونِ حالت — امضایِ HMAC-SHA256 روی یک payloadِ JSON.
 * عمداً کتابخانهٔ JWT اضافه نشد: همان کارِ لازم را با `crypto`ی خودِ نود
 * می‌کند و یک وابستگیِ کمتر یعنی یک سطحِ حملهٔ کمتر.
 *
 * راز از AUTH_TOKEN_SECRET می‌آید و اگر نبود از FLOWSTUDIO_SECRET —
 * همان رازی که کلیدهای درگاه با آن رمز می‌شوند.
 */

const TTL_SECONDS = 30 * 24 * 60 * 60; // ۳۰ روز

export interface SessionPayload {
  sub: string; // userId
  phone: string;
  exp: number; // ثانیهٔ یونیکس
}

function secret(): string {
  return (
    process.env.AUTH_TOKEN_SECRET ??
    process.env.FLOWSTUDIO_SECRET ??
    'dev-only-insecure-secret-change-me'
  );
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(body: string): string {
  return b64url(createHmac('sha256', secret()).update(body).digest());
}

export function issueToken(user: { id: string; phone: string }): string {
  const payload: SessionPayload = {
    sub: user.id,
    phone: user.phone,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${sign(body)}`;
}

/** در صورتِ هر ایرادی `null` — هرگز استثنا پرتاب نمی‌کند. */
export function verifyToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = sign(body);
  // مقایسهٔ زمان‌ثابت — طولِ نابرابر خودش خطاست، پس اول چک می‌شود.
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as SessionPayload;
    if (!payload?.sub || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
