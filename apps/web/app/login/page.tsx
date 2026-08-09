'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiBase, saveSession } from '@/lib/session';

/**
 * ورود با موبایل + OTP (D-008) — فعلاً حالتِ سندباکس.
 * درگاهِ پیامکی هنوز خریداری نشده، پس API خودِ کد را برمی‌گرداند و همین‌جا
 * نشان داده و خودکار پر می‌شود. وقتی درگاه آمد، تنها چیزی که عوض می‌شود
 * ناپدیدشدنِ همین جعبهٔ زرد است.
 */

type Step = 'phone' | 'code';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/studio';

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sandboxCode, setSandboxCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/api/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      if (data.code) {
        setSandboxCode(data.code);
        setCode(data.code); // در سندباکس بی‌معنی است که دستی تایپ شود
      }
      setStep('code');
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      saveSession(data.token, data.user.phone);
      router.push(next);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 13,
    borderRadius: 10,
    border: '1px solid var(--line)',
    background: 'var(--input)',
    color: 'var(--white)',
    fontSize: 16,
    letterSpacing: 1,
    direction: 'ltr',
    textAlign: 'center',
  };

  return (
    <main style={{ padding: '70px 22px', maxWidth: 440, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>ورود به FlowStudio</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 26px', fontSize: 14 }}>
        با شمارهٔ موبایل وارد شو تا پروژه‌هایت در کتابخانه‌ات ذخیره شوند.
      </p>

      {step === 'phone' ? (
        <form onSubmit={requestCode} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>شمارهٔ موبایل</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09123456789"
            inputMode="tel"
            autoFocus
            style={inputStyle}
          />
          <button className="btn" disabled={busy || !phone.trim()}>
            {busy ? 'در حالِ ارسال…' : 'دریافتِ کد'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sandboxCode && (
            <div
              style={{
                background: 'var(--amber-bg)',
                border: '1px solid var(--amber-line)',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 13,
                lineHeight: 1.9,
                color: 'var(--amber)',
              }}
            >
              <b>حالتِ سندباکس</b> — درگاهِ پیامکی هنوز وصل نشده، پس پیامکی فرستاده نشد.
              کدِ نمونه: <b style={{ direction: 'ltr', display: 'inline-block' }}>{sandboxCode}</b>
            </div>
          )}
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>کدِ تأیید</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            autoFocus
            style={inputStyle}
          />
          <button className="btn" disabled={busy || !code.trim()}>
            {busy ? 'در حالِ بررسی…' : 'ورود'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setError(null);
            }}
            style={{
              background: 'none',
              border: 0,
              color: 'var(--muted)',
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            تغییرِ شماره
          </button>
        </form>
      )}

      {error && (
        <div
          className="card"
          style={{ borderColor: 'var(--red-line)', background: 'var(--red-bg)', marginTop: 16 }}
        >
          <span style={{ color: 'var(--red)', fontSize: 13.5 }}>{error}</span>
        </div>
      )}
    </main>
  );
}

/**
 * 🔴 `useSearchParams()` بدونِ `<Suspense>` بیلدِ Next را می‌شکند
 * («missing suspense boundary») — و `tsc` این را نمی‌گیرد.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ padding: 70, textAlign: 'center' }}>…</main>}>
      <LoginForm />
    </Suspense>
  );
}
