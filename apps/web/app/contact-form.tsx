'use client';

import { useState } from 'react';

const SUBJECTS = ['درخواست دمو', 'اتصال پنل سایت من', 'همکاری و نمایندگی', 'پشتیبانی فنی'];

type Status = { kind: 'idle' | 'sending' | 'ok' | 'error'; message?: string };

export default function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === 'sending') return;
    setStatus({ kind: 'sending' });

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'ارسال نشد');
      form.reset();
      setStatus({ kind: 'ok', message: 'پیام ثبت شد. همان روزِ کاری پاسخ می‌دهیم.' });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message });
    }
  }

  return (
    <form className="card" style={{ padding: 22 }} onSubmit={onSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div className="field-label">نام</div>
          <input name="name" required maxLength={120} className="field" placeholder="نام و نام خانوادگی" />
        </div>
        <div>
          <div className="field-label">کسب‌وکار</div>
          <input name="business" maxLength={120} className="field" placeholder="نام برند" />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="field-label">ایمیل یا شمارهٔ تماس</div>
        <input name="contact" required maxLength={160} className="field ltr" placeholder="راه ارتباطی" />
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="field-label">موضوع</div>
        <select name="subject" className="field" defaultValue={SUBJECTS[0]}>
          {SUBJECTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="field-label">پیام</div>
        <textarea
          name="message"
          required
          maxLength={4000}
          className="field"
          placeholder="کوتاه بنویسید چه چیزی می‌خواهید بسازید"
        />
      </div>

      <button
        type="submit"
        className="btn"
        disabled={status.kind === 'sending'}
        style={{ width: '100%', marginTop: 14, padding: 11, fontSize: 14.5 }}
      >
        {status.kind === 'sending' ? 'در حال ارسال…' : 'ارسال پیام'}
      </button>

      {status.message && (
        <div
          style={{
            fontSize: 13.5,
            marginTop: 10,
            textAlign: 'center',
            color: status.kind === 'ok' ? 'var(--green)' : 'var(--red)',
          }}
        >
          {status.message}
        </div>
      )}

      <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 9, textAlign: 'center' }}>
        با ارسال، با شرایط استفاده و سیاست حریم خصوصی موافقت می‌کنید.
      </div>
    </form>
  );
}
