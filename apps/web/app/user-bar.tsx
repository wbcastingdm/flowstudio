'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, displayPhone, getPhone, getToken } from '@/lib/session';

/**
 * نوارِ بالایِ صفحه‌های داخلی — شماره، کتابخانه، خروج.
 * چون توکن در `localStorage` است، وضعیت فقط بعد از mount معلوم می‌شود؛
 * تا آن لحظه چیزی رندر نمی‌کنیم تا پرشِ محتوا (hydration mismatch) ندهد.
 */
export function UserBar({ active }: { active?: 'studio' | 'library' }) {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPhone(getToken() ? getPhone() : null);
    setReady(true);
  }, []);

  if (!ready) return <div style={{ height: 44 }} />;

  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    fontSize: 13.5,
    color: isActive ? 'var(--accent)' : 'var(--muted)',
    fontWeight: isActive ? 700 : 400,
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        paddingBottom: 14,
        marginBottom: 24,
        borderBottom: '1px solid var(--line)',
      }}
    >
      <a href="/studio" style={linkStyle(active === 'studio')}>استودیو</a>
      <a href="/library" style={linkStyle(active === 'library')}>کتابخانهٔ من</a>
      <span style={{ flex: 1 }} />
      {phone ? (
        <>
          <span style={{ fontSize: 12.5, color: 'var(--dim)', direction: 'ltr' }}>
            {displayPhone(phone)}
          </span>
          <button
            onClick={() => {
              clearSession();
              router.push('/login');
            }}
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
            خروج
          </button>
        </>
      ) : (
        <a href="/login" style={{ fontSize: 13.5 }}>ورود</a>
      )}
    </div>
  );
}
