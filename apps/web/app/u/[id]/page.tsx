'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiBase } from '@/lib/session';

type Profile = {
  id: string;
  name: string;
  bio: string | null;
  joinedAt: string;
  works: { id: string; title: string; type: string | null; durationSec: number | null; views: number }[];
};

export default function CreatorPage() {
  const params = useParams<{ id: string }>();
  const [p, setP] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase()}/api/public/creators/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? 'پیدا نشد');
        return r.json();
      })
      .then(setP)
      .catch((e) => setError(String(e.message ?? e)));
  }, [params.id]);

  if (error) return <main style={{ padding: '80px 22px' }}><div className="card">{error}</div></main>;
  if (!p) return <main style={{ padding: '80px 22px' }}>در حال خواندن…</main>;

  return (
    <main style={{ padding: '44px 22px', maxWidth: 860, margin: '0 auto' }}>
      <a href="/discover" style={{ fontSize: 14, color: 'var(--muted)' }}>
        ← کارهای منتشرشده
      </a>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '14px 0 8px' }}>{p.name}</h1>
      {p.bio && <p style={{ color: 'var(--muted)', lineHeight: 2, margin: '0 0 8px' }}>{p.bio}</p>}
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 28px' }}>
        {p.works.length.toLocaleString('fa-IR')} اثر عمومی
      </p>

      {p.works.length === 0 && <div className="card" style={{ color: 'var(--muted)' }}>هنوز اثری عمومی نکرده.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 13 }}>
        {p.works.map((w) => (
          <a key={w.id} href={`/w/${w.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b style={{ fontSize: 14.5, lineHeight: 1.6 }}>{w.title}</b>
            <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>
              {w.type ?? '—'} · {w.views.toLocaleString('fa-IR')} بازدید
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}
