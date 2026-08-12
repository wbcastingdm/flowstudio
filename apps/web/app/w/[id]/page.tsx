'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiBase, apiFetch, getToken } from '@/lib/session';

type Shot = {
  id: string;
  order: number;
  durationSec: number;
  description: string;
  cameraMovement: string;
  direction: { miseEnScene: string | null; shotSize: string | null; lighting: string | null } | null;
};

type Work = {
  id: string;
  title: string;
  targetDurationSec: number | null;
  materialStyle: string | null;
  productionType: { title: string } | null;
  user: { id: string; name: string };
  video: { durationSec: number | null; byteSize: number } | null;
  views: number;
  publishedAt: string | null;
  sequences: { id: string; order: number; title: string; shots: Shot[] }[];
  comments: { id: string; body: string; createdAt: string; author: string }[];
};

export default function WorkPage() {
  const params = useParams<{ id: string }>();
  const [work, setWork] = useState<Work | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');

  function load() {
    fetch(`${apiBase()}/api/public/works/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? 'پیدا نشد');
        return r.json();
      })
      .then(setWork)
      .catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(load, [params.id]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!getToken()) {
      setNote('برای گذاشتن دیدگاه باید وارد شوی.');
      return;
    }
    setSending(true);
    setNote('');
    try {
      const res = await apiFetch(`/api/comments/${params.id}`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setBody('');
      load();
    } catch (err) {
      setNote(String(err instanceof Error ? err.message : err));
    } finally {
      setSending(false);
    }
  }

  if (error) {
    return (
      <main style={{ padding: '80px 22px', maxWidth: 620, margin: '0 auto' }}>
        <div className="card">{error}</div>
        <p style={{ marginTop: 16 }}>
          <a href="/discover">← برگرد به کارهای منتشرشده</a>
        </p>
      </main>
    );
  }
  if (!work) return <main style={{ padding: '80px 22px' }}>در حال خواندن…</main>;

  const total = work.sequences.flatMap((s) => s.shots).reduce((n, s) => n + s.durationSec, 0);

  return (
    <main style={{ padding: '44px 22px', maxWidth: 860, margin: '0 auto' }}>
      <a href="/discover" style={{ fontSize: 14, color: 'var(--muted)' }}>
        ← کارهای منتشرشده
      </a>
      <h1 style={{ fontSize: 27, fontWeight: 800, margin: '14px 0 10px' }}>{work.title}</h1>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 26 }}>
        {work.productionType && (
          <span className="chip" style={{ fontSize: 13.5, padding: '4px 10px' }}>
            {work.productionType.title}
          </span>
        )}
        <span className="chip" style={{ fontSize: 13.5, padding: '4px 10px' }}>
          {(work.video?.durationSec ?? total).toLocaleString('fa-IR')} ثانیه
        </span>
        <span className="chip" style={{ fontSize: 13.5, padding: '4px 10px' }}>
          {work.views.toLocaleString('fa-IR')} بازدید
        </span>
        <a href={`/u/${work.user.id}`} className="chip" style={{ fontSize: 13.5, padding: '4px 10px' }}>
          {work.user.name}
        </a>
      </div>

      {/*
        فایل از مسیر عمومی می‌آید، نه از `/api/assets/:id/file` که ورود
        می‌خواهد و همیشه `attachment` می‌فرستد. آدرس از شناسه اثر ساخته
        می‌شود و هیچ شناسه دارایی‌ای در صفحه نمی‌نشیند.
      */}
      {work.video && (
        <video
          src={`${apiBase()}/api/public/works/${params.id}/video`}
          controls
          playsInline
          preload="metadata"
          style={{
            width: 'min(300px, 100%)',
            borderRadius: 12,
            border: '1px solid var(--line)',
            background: '#000',
            display: 'block',
            marginBottom: 26,
          }}
        />
      )}

      {work.sequences.map((seq) => (
        <div key={seq.id} style={{ marginBottom: 22 }}>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 10 }}>
            سکانس {seq.order.toLocaleString('fa-IR')} — {seq.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {seq.shots.map((shot) => (
              <div key={shot.id} className="card" style={{ display: 'flex', gap: 13, padding: 15 }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    border: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  {shot.order.toLocaleString('fa-IR')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ lineHeight: 1.95, fontSize: 14 }}>{shot.description}</div>
                  {shot.direction?.miseEnScene && (
                    <div style={{ marginTop: 7, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.9 }}>
                      {shot.direction.miseEnScene}
                    </div>
                  )}
                  <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--muted)' }}>
                    {shot.durationSec.toLocaleString('fa-IR')} ثانیه
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <section style={{ marginTop: 34 }}>
        <h2 style={{ fontSize: 17, fontWeight: 750, margin: '0 0 14px' }}>
          دیدگاه‌ها ({work.comments.length.toLocaleString('fa-IR')})
        </h2>

        <form onSubmit={send} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="نظرت درباره این کار چیست؟"
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 9,
              border: '1px solid var(--line)',
              background: 'var(--surface-2, #171a21)',
              color: 'var(--white)',
              fontFamily: 'inherit',
              fontSize: 14,
              lineHeight: 1.9,
              resize: 'vertical',
            }}
          />
          <button className="btn btn-sm" disabled={sending || body.trim().length < 2} style={{ alignSelf: 'flex-start' }}>
            {sending ? 'در حال فرستادن…' : 'ثبت دیدگاه'}
          </button>
          {note && <div style={{ fontSize: 14, color: '#e08a8a' }}>{note}</div>}
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {work.comments.map((c) => (
            <div key={c.id} className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 6 }}>{c.author}</div>
              <div style={{ fontSize: 14, lineHeight: 1.95 }}>{c.body}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
