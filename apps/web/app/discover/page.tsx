'use client';

import { useEffect, useState } from 'react';
import { apiBase } from '@/lib/session';

type Work = {
  id: string;
  title: string;
  type: string | null;
  typeKey: string | null;
  durationSec: number | null;
  material: string | null;
  creator: { id: string; name: string };
  views: number;
  comments: number;
  publishedAt: string | null;
};

const MATERIAL_FA: Record<string, string> = {
  REAL: 'واقعی',
  ANIME: 'انیمه',
  COMIC: 'کمیک',
  FANTASY: 'فانتزی',
  THREE_D: 'سه بعدی',
  STOP_MOTION: 'استاپ موشن',
};

function dur(sec: number | null): string {
  if (!sec) return '';
  if (sec < 60) return `${sec} ثانیه`;
  if (sec < 3600) return `${Math.round(sec / 60)} دقیقه`;
  return `${Math.round((sec / 3600) * 10) / 10} ساعت`;
}

export default function DiscoverPage() {
  const [works, setWorks] = useState<Work[] | null>(null);

  useEffect(() => {
    fetch(`${apiBase()}/api/public/discover`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setWorks)
      .catch(() => setWorks([]));
  }, []);

  return (
    <main style={{ padding: '46px 22px', maxWidth: 1000, margin: '0 auto' }}>
      <div className="pill">سایت عمومی</div>
      <h1 style={{ fontSize: 27, fontWeight: 800, margin: '12px 0 8px' }}>کارهای منتشرشده</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 30px', lineHeight: 2, maxWidth: '58ch' }}>
        آنچه سازنده‌ها ساخته‌اند و برای دیدن دیگران عمومی کرده‌اند.
      </p>

      {works === null && <div className="card">در حال خواندن…</div>}

      {works?.length === 0 && (
        <div className="card" style={{ color: 'var(--muted)', lineHeight: 1.95 }}>
          هنوز هیچ اثری عمومی نشده. اولین نفر باش — از استودیو یک اثر بساز و از آرشیو
          رسانه عمومی‌اش کن.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(255px,1fr))', gap: 14 }}>
        {works?.map((w) => (
          <a
            key={w.id}
            href={`/w/${w.id}`}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <b style={{ fontSize: 15, lineHeight: 1.6 }}>{w.title}</b>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {w.type && (
                <span className="chip" style={{ fontSize: 13, padding: '3px 9px' }}>
                  {w.type}
                </span>
              )}
              {w.material && (
                <span className="chip" style={{ fontSize: 13, padding: '3px 9px' }}>
                  {MATERIAL_FA[w.material] ?? w.material}
                </span>
              )}
              {w.durationSec && (
                <span className="chip" style={{ fontSize: 13, padding: '3px 9px' }}>
                  {dur(w.durationSec)}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 'auto' }}>
              {w.creator.name} · {w.views.toLocaleString('fa-IR')} بازدید
              {w.comments > 0 && ` · ${w.comments.toLocaleString('fa-IR')} دیدگاه`}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
