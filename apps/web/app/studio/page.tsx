'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getToken } from '@/lib/session';
import { UserBar } from '../user-bar';

type Shot = {
  id: string;
  order: number;
  durationSec: number;
  description: string;
  cameraMovement: string;
};

type Sequence = { id: string; order: number; title: string; shots: Shot[] };

type Project = {
  id: string;
  title: string;
  goal: string;
  tone: string;
  sequences: Sequence[];
};

type Result = {
  project: Project;
  modelUsed: string;
  providerUsed: string;
  costActual: number;
};

const GOALS = [
  ['BRAND_AWARENESS', 'آگاهی از برند'],
  ['ORDER_CAPTURE', 'جذب سفارشِ آنلاین'],
  ['PRODUCT_INTRO', 'معرفیِ محصولِ جدید'],
] as const;

const TONES = [
  ['WARM_FRIENDLY', 'گرم و صمیمی'],
  ['PROFESSIONAL', 'حرفه‌ای'],
  ['ENERGETIC', 'پرانرژی'],
] as const;

const DURATIONS = [15, 30, 60, 90];

export default function StudioPage() {
  const router = useRouter();
  const [rawIdea, setRawIdea] = useState('');
  const [goal, setGoal] = useState<string>('BRAND_AWARENESS');
  const [tone, setTone] = useState<string>('WARM_FRIENDLY');
  const [targetDurationSec, setTargetDurationSec] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // ساختِ پروژه از اسپرینتِ ۴ محافظت‌شده است — بدونِ ورود، به صفحهٔ ورود می‌رود.
  useEffect(() => {
    if (!getToken()) router.push('/login?next=/studio');
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ rawIdea, goal, tone, targetDurationSec }),
      });
      if (res.status === 401) {
        router.push('/login?next=/studio');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  const totalDuration =
    result?.project.sequences
      .flatMap((s) => s.shots)
      .reduce((sum, sh) => sum + sh.durationSec, 0) ?? 0;

  return (
    <main style={{ padding: '40px 22px', maxWidth: 980, margin: '0 auto' }}>
      <UserBar active="studio" />
      <div className="pill">مرحلهٔ ۱ — ایده تا بریف · رایگان</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: '12px 0 8px' }}>
        ایده‌ات را بنویس، شات‌لیست بگیر
      </h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 28px', lineHeight: 2, maxWidth: '60ch' }}>
        ایده را به زبانِ خودت بنویس. سیستم آن را به یک شات‌لیستِ ساختاریافته با مدتِ هر نما تبدیل
        می‌کند — با قواعدِ عددیِ تبلیغات (ABCDِ گوگل). این مرحله همیشه رایگان است.
      </p>

      <form onSubmit={submit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <textarea
          value={rawIdea}
          onChange={(e) => setRawIdea(e.target.value)}
          placeholder="مثلاً: یک نانواییِ سنتیِ سنگک که تازه شعبهٔ دوم را باز کرده و می‌خواهد مشتری‌های محله را خبر کند."
          rows={5}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'var(--surface-2, #171a21)',
            color: 'var(--white)',
            fontFamily: 'inherit',
            fontSize: 14.5,
            lineHeight: 2,
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>هدفِ کمپین</span>
            <select value={goal} onChange={(e) => setGoal(e.target.value)}>
              {GOALS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>لحن</span>
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              {TONES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>مدتِ هدف</span>
            <select
              value={targetDurationSec}
              onChange={(e) => setTargetDurationSec(Number(e.target.value))}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{d} ثانیه</option>
              ))}
            </select>
          </label>
        </div>

        <button className="btn" disabled={busy || !rawIdea.trim()} style={{ alignSelf: 'flex-start' }}>
          {busy ? 'در حالِ ساخت…' : 'ساختِ شات‌لیست'}
        </button>
      </form>

      {error && (
        <div className="card" style={{ borderColor: '#a32f2f', marginTop: 20 }}>
          <b style={{ color: '#e08a8a' }}>ساخته نشد</b>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)', lineHeight: 1.9, fontSize: 13.5 }}>{error}</p>
          <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: 12.5 }}>
            اگر می‌گوید هیچ مدلِ TEXTی ثبت نشده: اول از{' '}
            <a href="/admin/models" style={{ color: 'var(--accent, #7c8cff)' }}>پنلِ رجیستریِ مدل‌ها</a>{' '}
            یک درگاه با کلیدِ واقعی اضافه کن.
          </p>
        </div>
      )}

      {result && (
        <section style={{ marginTop: 30 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <h2 style={{ fontSize: 21, fontWeight: 800, margin: 0 }}>{result.project.title}</h2>
            <span className="chip" style={{ padding: '5px 11px', fontSize: 12.5 }}>
              مجموع: {totalDuration} ثانیه
            </span>
            <span className="chip" style={{ padding: '5px 11px', fontSize: 12.5 }}>
              مدل: {result.modelUsed}
            </span>
            <span className="chip" style={{ padding: '5px 11px', fontSize: 12.5 }}>
              هزینه: {result.costActual} سکه
            </span>
          </div>

          {result.project.sequences.map((seq) => (
            <div key={seq.id} style={{ marginBottom: 22 }}>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>
                سکانسِ {seq.order} — {seq.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {seq.shots.map((shot) => (
                  <div
                    key={shot.id}
                    className="card"
                    style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 16 }}
                  >
                    <div
                      style={{
                        flexShrink: 0,
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 15,
                      }}
                    >
                      {shot.order}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ lineHeight: 1.95, fontSize: 14 }}>{shot.description}</div>
                      <div style={{ marginTop: 7, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {shot.durationSec} ثانیه
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>·</span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          دوربین: {shot.cameraMovement}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="card" style={{ marginTop: 8 }}>
            <b>مرحلهٔ بعد</b>
            <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 13.4, lineHeight: 1.95 }}>
              تولیدِ فریمِ کلیدیِ هر نما (مرحلهٔ ۲) هنوز ساخته نشده — آن مرحله پرداختی است و
              در اسپرینتِ بعدی می‌آید.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
