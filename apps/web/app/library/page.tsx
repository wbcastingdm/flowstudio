'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getToken } from '@/lib/session';
import { UserBar } from '../user-bar';
import { RenderPanel } from '../render-panel';

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
  createdAt: string;
  productionType: { key: string; title: string } | null;
  sequences: Sequence[];
};

const MOVE_FA: Record<string, string> = {
  STATIC: 'ثابت',
  PAN: 'پن',
  TILT: 'تیلت',
  DOLLY: 'دالی',
  HANDHELD: 'روی دست',
  COMBINED: 'ترکیبی',
};

function toFa(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

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

      <h1 className="page-title" style={{ marginTop: 0 }}>کتابخانه من</h1>
      <p className="page-lead">
        هر پروژه‌ای که ساخته‌ای این‌جا می‌ماند — به حساب خودت، نه به کاربر عمومی. با باز کردن
        هر پروژه، نماهایش و فایل ساخته‌شده‌اش را می‌بینی.
      </p>

      {error && <div className="note note-red">{error}</div>}

      {projects === null && !error && <div className="card meta">در حال بارگذاری…</div>}

      {projects?.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 36 }}>
          <p className="meta-strong" style={{ margin: '0 0 18px' }}>هنوز پروژه‌ای نساخته‌ای.</p>
          <a href="/studio" className="btn">ساخت اولین شات‌لیست</a>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {projects?.map((p) => {
          const shots = p.sequences.flatMap((s) => s.shots);
          const total = shots.reduce((sum, sh) => sum + sh.durationSec, 0);
          const open = openId === p.id;
          return (
            <div key={p.id} className="card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 17 }}>{p.title}</b>
                <span className="meta">{faDate(p.createdAt)}</span>
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setOpenId(open ? null : p.id)}
                >
                  {open ? 'بستن' : 'باز کردن'}
                </button>
              </div>

              <div className="tags" style={{ marginTop: 12 }}>
                {p.productionType && <span className="tag">{p.productionType.title}</span>}
                <span className="tag">{toFa(shots.length)} نما</span>
                <span className="tag">{toFa(total)} ثانیه</span>
              </div>

              {open && (
                <div style={{ marginTop: 18 }}>
                  {p.sequences.map((seq) => (
                    <div key={seq.id} style={{ marginBottom: 16 }}>
                      <div className="meta-strong" style={{ marginBottom: 9 }}>
                        سکانس {toFa(seq.order)} — {seq.title}
                      </div>
                      {seq.shots.map((shot) => (
                        <div key={shot.id} className="row">
                          <div className="row-num">{toFa(shot.order)}</div>
                          <div className="row-body">
                            <div className="row-title">{shot.description}</div>
                            <div className="tags" style={{ marginTop: 8 }}>
                              <span className="tag">{toFa(shot.durationSec)} ثانیه</span>
                              <span className="tag">
                                دوربین: {MOVE_FA[shot.cameraMovement] ?? shot.cameraMovement}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* پنل خودش می‌فهمد این پروژه ساخته شده یا نه، و اگر شده
                      فایلش را نشان می‌دهد؛ اگر نه، دکمه ساخت می‌گذارد. */}
                  <RenderPanel projectId={p.id} title={p.title} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
