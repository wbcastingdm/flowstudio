'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiBase, saveSession } from '@/lib/session';

/**
 * ورود — شمارهٔ موبایل + رمزِ عددی.
 *
 * صفحه هیچ فرضی دربارهٔ سازوکارِ ورود نمی‌کند: `/api/auth/policy` می‌گوید
 * رمز چند رقم است و آیا باید نشان داده شود. روزی که پیامک وصل شود، همان
 * مسیر `mode` دیگری برمی‌گرداند و این صفحه دو مرحله‌ای می‌شود — بدونِ اینکه
 * چیزی این‌جا hard-code شده باشد که کسی یادش برود عوضش کند.
 */

interface Policy {
  mode: string;
  digits: number;
  hint: string | null;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/studio';

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase()}/api/auth/policy`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setPolicy)
      .catch(() => setPolicy(null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
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

  // شماره و رمز هر دو عددند و از چپ خوانده می‌شوند؛ وسط‌چین با فاصلهٔ حروف
  // خواندنشان را از یک ردیفِ چسبیدهٔ رقم بیرون می‌آورد.
  const numeric: React.CSSProperties = {
    direction: 'ltr',
    textAlign: 'center',
    fontSize: 19,
    letterSpacing: 3,
    padding: '14px 13px',
  };

  return (
    <main style={{ padding: '68px 22px', maxWidth: 440, margin: '0 auto' }}>
      <h1 style={{ fontSize: 27, fontWeight: 800, margin: '0 0 10px' }}>ورود به فلواستودیو</h1>
      <p className="page-lead" style={{ marginBottom: 24 }}>
        با شماره موبایل وارد شو تا پروژه‌هایت در کتابخانه خودت بماند.
      </p>

      <form onSubmit={submit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field-row">
          <span className="field-name">شماره موبایل</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09123456789"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            style={numeric}
          />
        </div>

        <div className="field-row">
          <span className="field-name">
            رمز عددی{policy ? ` — ${toFa(policy.digits)} رقم` : ''}
          </span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••"
            inputMode="numeric"
            autoComplete="current-password"
            style={numeric}
          />
        </div>

        <button className="btn" disabled={busy || !phone.trim() || !password.trim()}>
          {busy ? 'در حال بررسی…' : 'ورود'}
        </button>

        {policy?.hint && (
          <div className="note note-amber">
            <b>حالت آزمایشی</b> — درگاه پیامک هنوز وصل نشده، پس رمز فعلا برای همه یکی است:{' '}
            <b style={{ direction: 'ltr', display: 'inline-block', letterSpacing: 2 }}>
              {policy.hint}
            </b>
          </div>
        )}
      </form>

      {error && (
        <div className="note note-red" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}
    </main>
  );
}

function toFa(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
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
