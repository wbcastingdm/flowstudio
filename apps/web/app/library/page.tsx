'use client';

import { useCallback, useEffect, useState } from 'react';
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
  createdAt: string;
  sequences: Sequence[];
};

const GOAL_LABELS: Record<string, string> = {
  BRAND_AWARENESS: 'آگاهی از برند',
  ORDER_CAPTURE: 'جذب سفارش',
  PRODUCT_INTRO: 'معرفیِ محصول',
};

const TONE_LABELS: Record<string, string> = {
  WARM_FRIENDLY: 'گرم و صمیمی',
  PROFESSIONAL: 'حرفه‌ای',
  ENERGETIC: 'پرانرژی',
};

function faDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export default function LibraryPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/projects');
      if (res.status === 401) {
        router.push('/login?next=/library');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setProjects(data);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login?next=/library');
      return;
    }
    void load();
  }, [load, router]);

  return (
    <main style={{ padding: '40px 22px', maxWidth: 980, margin: '0 auto' }}>
      <UserBar active="library" />

      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px' }}>کتابخانهٔ من</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 26px', fontSize: 14 }}>
        هر شات‌لیستی که ساخته‌ای اینجا می‌ماند — به حسابِ خودت، نه به کاربرِ عمومی.
      </p>

      {error && (
        <div className="card" style={{ borderColor: 'var(--red-line)', background: 'var(--red-bg)' }}>
          <span style={{ color: 'var(--red)', fontSize: 13.5 }}>{error}</span>
        </div>
      )}

      {projects === null && !error && (
        <div className="card" style={{ color: 'var(--muted)', fontSize: 13.5 }}>در حالِ بارگذاری…</div>
      )}

      {projects?.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 34 }}>
          <p style={{ color: 'var(--muted)', margin: '0 0 16px', fontSize: 14 }}>
            هنوز پروژه‌ای نساخته‌ای.
          </p>
          <a href="/studio" className="btn">ساختِ اولین شات‌لیست</a>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {projects?.map((p) => {
          const shots = p.sequences.flatMap((s) => s.shots);
          const total = shots.reduce((sum, sh) => sum + sh.durationSec, 0);
          const open = openId === p.id;
          return (
            <div key={p.id} className="card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 16 }}>{p.title}</b>
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>{faDate(p.createdAt)}</span>
                <span style={{ flex: 1 }} />
                <button
                  onClick={() => setOpenId(open ? null : p.id)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: '5px 12px',
                    color: 'var(--muted)',
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  {open ? 'بستن' : 'نمایشِ نماها'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {[
                  GOAL_LABELS[p.goal] ?? p.goal,
                  TONE_LABELS[p.tone] ?? p.tone,
                  `${shots.length} نما`,
                  `${total} ثانیه`,
                ].map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 12,
                      color: 'var(--muted)',
                      border: '1px solid var(--line)',
                      borderRadius: 999,
                      padding: '3px 10px',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>

              {open && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {p.sequences.map((seq) => (
                    <div key={seq.id}>
                      <div style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 8 }}>
                        سکانسِ {seq.order} — {seq.title}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {seq.shots.map((shot) => (
                          <div
                            key={shot.id}
                            style={{
                              display: 'flex',
                              gap: 12,
                              padding: 12,
                              borderRadius: 10,
                              background: 'var(--surface-2)',
                              border: '1px solid var(--line)',
                            }}
                          >
                            <b style={{ color: 'var(--dim)', fontSize: 13 }}>{shot.order}</b>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>{shot.description}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 4 }}>
                                {shot.durationSec} ثانیه · دوربین: {shot.cameraMovement}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
