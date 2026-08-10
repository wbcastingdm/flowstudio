'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiBase } from '@/lib/session';

const ADMIN_KEY = 'flowstudio_admin_key';

type Overview = {
  users: { total: number; new7d: number };
  projects: { total: number; new7d: number; shots: number };
  assets: number;
  wallet: { balance: number; held: number; activeHolds: number; totalSpent: number };
  jobs: Record<string, number>;
  providerCalls24h: { total: number; failed: number; errorRate: number | null };
  pendingReviews: number;
};

type UserRow = {
  id: string;
  phone: string;
  joinedAt: string;
  balance: number;
  held: number;
  projectCount: number;
  assetCount: number;
  lastActivityAt: string;
  lastTier: string | null;
};

type Production = {
  byType: { label: string; count: number }[];
  byTier: { label: string; count: number }[];
  byMaterial: { label: string; count: number }[];
  successRate: number | null;
  finishedJobs: number;
  avgShotDurationSec: number | null;
  totalShotSeconds: number;
};

type ProviderHealth = {
  id: string;
  name: string;
  host: string;
  calls: number;
  failed: number;
  errorRate: number | null;
  avgLatencyMs: number | null;
  errorKinds: { kind: string; count: number }[];
};

type LedgerRow = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  heldAfter: number;
  note: string | null;
  purpose: string | null;
  phone: string;
  createdAt: string;
};

const TABS = [
  ['overview', 'یک نگاه'],
  ['users', 'کاربران'],
  ['production', 'تولید'],
  ['providers', 'سلامت درگاه'],
  ['ledger', 'دفتر سکه'],
] as const;

type Tab = (typeof TABS)[number][0];

function fa(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('fa-IR');
}

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'همین حالا';
  if (m < 60) return `${fa(m)} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${fa(h)} ساعت پیش`;
  return `${fa(Math.floor(h / 24))} روز پیش`;
}

export default function AdminDashboard() {
  const [key, setKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [gateNote, setGateNote] = useState('');

  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [production, setProduction] = useState<Production | null>(null);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const get = useCallback(
    async (path: string, k = key) => {
      const res = await fetch(`${apiBase()}${path}`, { headers: { 'x-admin-key': k } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    [key],
  );

  const loadTab = useCallback(
    async (which: Tab, k = key) => {
      setLoading(true);
      setError(null);
      try {
        if (which === 'overview') setOverview(await get('/api/admin/overview', k));
        if (which === 'users') setUsers(await get('/api/admin/users', k));
        if (which === 'production') setProduction(await get('/api/admin/stats/production', k));
        if (which === 'providers') setProviders(await get('/api/admin/stats/providers', k));
        if (which === 'ledger') setLedger(await get('/api/admin/ledger', k));
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      } finally {
        setLoading(false);
      }
    },
    [get, key],
  );

  const tryUnlock = useCallback(
    async (k: string, quiet = false) => {
      try {
        const data = await get('/api/admin/overview', k);
        setKey(k);
        setUnlocked(true);
        setOverview(data);
        window.sessionStorage.setItem(ADMIN_KEY, k);
        return true;
      } catch (e) {
        window.sessionStorage.removeItem(ADMIN_KEY);
        if (!quiet) setGateNote(String(e instanceof Error ? e.message : e));
        return false;
      }
    },
    [get],
  );

  useEffect(() => {
    const saved = window.sessionStorage.getItem(ADMIN_KEY);
    if (saved) void tryUnlock(saved, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!unlocked) {
    return (
      <main style={{ padding: '80px 22px', maxWidth: 460, margin: '0 auto' }}>
        <div className="pill">پنل راهبر سیستم</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '10px 0 6px' }}>رمز پنل</h1>
        <p style={{ color: 'var(--muted)', margin: '0 0 22px', fontSize: 14, lineHeight: 1.9 }}>
          این پنل داده همه کاربران و کلید سرویس‌ها را نشان می‌دهد، پس روی دامنه عمومی
          باز نمی‌ماند.
        </p>
        <form
          className="card"
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            setGateNote('');
            void tryUnlock(keyInput.trim());
          }}
        >
          <input
            type="password"
            placeholder="رمز پنل"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            autoFocus
          />
          <button className="btn btn-sm">ورود</button>
          {gateNote && <div style={{ color: '#e08a8a', fontSize: 13 }}>{gateNote}</div>}
        </form>
      </main>
    );
  }

  return (
    <main style={{ padding: '38px 22px', maxWidth: 1100, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 22,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>پنل راهبر</h1>
        <a href="/admin/models" style={{ fontSize: 13, color: 'var(--muted)' }}>
          رجیستری مدل‌ها ←
        </a>
        <button
          className="btn btn-sm"
          style={{ marginInlineStart: 'auto' }}
          onClick={() => void loadTab(tab)}
          disabled={loading}
        >
          {loading ? 'در حال خواندن…' : 'تازه‌سازی'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {TABS.map(([id, label]) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                void loadTab(id);
              }}
              style={{
                padding: '8px 15px',
                borderRadius: 9,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13.5,
                border: `1px solid ${on ? 'var(--accent-line-2, #7c8cff)' : 'var(--line)'}`,
                background: on ? 'var(--accent-bg, rgba(124,140,255,.12))' : 'transparent',
                color: on ? 'var(--accent-soft, #a8b3ff)' : 'var(--muted)',
                fontWeight: on ? 700 : 400,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="card" style={{ borderColor: '#a32f2f', marginBottom: 18 }}>
          <span style={{ color: '#e08a8a' }}>{error}</span>
        </div>
      )}

      {tab === 'overview' && overview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 12 }}>
            <Stat label="کاربر" value={fa(overview.users.total)} sub={`${fa(overview.users.new7d)} تازه در ۷ روز`} />
            <Stat label="اثر" value={fa(overview.projects.total)} sub={`${fa(overview.projects.new7d)} تازه در ۷ روز`} />
            <Stat label="نما" value={fa(overview.projects.shots)} sub={`${fa(overview.assets)} دارایی`} />
            <Stat
              label="سکه خرج‌شده"
              value={fa(overview.wallet.totalSpent)}
              sub={`${fa(overview.wallet.balance)} موجود · ${fa(overview.wallet.held)} رزرو`}
            />
            <Stat
              label="کار در صف"
              value={fa(overview.jobs.PENDING + overview.jobs.RUNNING)}
              sub={`${fa(overview.jobs.DONE)} تمام · ${fa(overview.jobs.FAILED)} ناموفق`}
              tone={overview.jobs.FAILED > 0 ? 'warn' : undefined}
            />
            <Stat
              label="نرخ خطای درگاه ۲۴ ساعت"
              value={overview.providerCalls24h.errorRate === null ? '—' : `${fa(overview.providerCalls24h.errorRate)}٪`}
              sub={`${fa(overview.providerCalls24h.total)} فراخوان`}
              tone={
                overview.providerCalls24h.errorRate !== null && overview.providerCalls24h.errorRate > 10
                  ? 'warn'
                  : undefined
              }
            />
            <Stat
              label="منتظر بازبینی"
              value={fa(overview.pendingReviews)}
              sub="پیش از خرج یا انتشار"
              tone={overview.pendingReviews > 0 ? 'warn' : undefined}
            />
          </div>

          {overview.projects.total === 0 && (
            <div className="card" style={{ fontSize: 13.5, lineHeight: 1.95, color: 'var(--muted)' }}>
              هنوز هیچ اثری ساخته نشده. تا وقتی یک درگاه با کلید واقعی در رجیستری ثبت نشود،
              مرحله ایده تا شات‌لیست خطای صادقانه می‌دهد و این جدول‌ها خالی می‌مانند.
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
        <Table
          head={['شماره', 'موجودی', 'رزرو', 'اثر', 'دارایی', 'آخرین سطح', 'آخرین فعالیت', 'عضویت']}
          rows={users.map((u) => [
            u.phone,
            fa(u.balance),
            fa(u.held),
            fa(u.projectCount),
            fa(u.assetCount),
            u.lastTier ?? '—',
            ago(u.lastActivityAt),
            ago(u.joinedAt),
          ])}
          empty="هنوز کاربری ثبت نشده."
        />
      )}

      {tab === 'production' && production && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 12 }}>
            <Stat
              label="نرخ موفقیت"
              value={production.successRate === null ? '—' : `${fa(production.successRate)}٪`}
              sub={`روی ${fa(production.finishedJobs)} کار تمام‌شده`}
            />
            <Stat
              label="میانگین مدت نما"
              value={production.avgShotDurationSec === null ? '—' : `${fa(production.avgShotDurationSec)} ثانیه`}
              sub={`مجموع ${fa(production.totalShotSeconds)} ثانیه`}
            />
          </div>
          <Breakdown title="به تفکیک نوع تولید" rows={production.byType} />
          <Breakdown title="به تفکیک سطح خدمت" rows={production.byTier} />
          <Breakdown title="به تفکیک جنس تصویر" rows={production.byMaterial} />
        </div>
      )}

      {tab === 'providers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {providers.length === 0 && (
            <div className="card" style={{ color: 'var(--muted)', fontSize: 13.5 }}>
              هیچ درگاهی ثبت نشده. از رجیستری مدل‌ها یکی اضافه کن.
            </div>
          )}
          {providers.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <b>{p.name}</b>
                <span style={{ fontSize: 12, color: 'var(--muted)', direction: 'ltr' }}>{p.host}</span>
                <span
                  style={{
                    marginInlineStart: 'auto',
                    fontSize: 13,
                    color: p.errorRate !== null && p.errorRate > 10 ? '#e08a8a' : 'var(--muted)',
                  }}
                >
                  {p.errorRate === null ? 'هنوز فراخوانی نشده' : `نرخ خطا ${fa(p.errorRate)}٪`}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                {fa(p.calls)} فراخوان در ۷ روز · {fa(p.failed)} ناموفق
                {p.avgLatencyMs !== null && ` · میانگین پاسخ ${fa(p.avgLatencyMs)} میلی‌ثانیه`}
              </div>
              {p.errorKinds.length > 0 && (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {p.errorKinds.map((e) => (
                    <span key={e.kind} className="chip" style={{ fontSize: 11.5, padding: '3px 9px' }}>
                      {e.kind}: {fa(e.count)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'ledger' && (
        <Table
          head={['نوع', 'مبلغ', 'موجودی پس از آن', 'رزرو', 'شماره', 'بابت', 'زمان']}
          rows={ledger.map((r) => [
            r.type,
            fa(r.amount),
            fa(r.balanceAfter),
            fa(r.heldAfter),
            r.phone,
            r.purpose ?? r.note ?? '—',
            ago(r.createdAt),
          ])}
          empty="دفتر خالی است — هنوز هیچ سکه‌ای جابه‌جا نشده."
        />
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'warn';
}) {
  return (
    <div className="card" style={{ padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
      <span
        style={{
          fontSize: 24,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: tone === 'warn' ? '#e0b060' : 'inherit',
        }}
      >
        {value}
      </span>
      {sub && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{sub}</span>}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <b style={{ fontSize: 13.5 }}>{title}</b>
      {rows.length === 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>داده‌ای نیست.</span>}
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, minWidth: 130 }}>{r.label}</span>
          <span
            style={{
              flex: 1,
              height: 7,
              background: 'var(--line)',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block',
                height: '100%',
                width: total ? `${(r.count / total) * 100}%` : '0%',
                background: 'var(--accent-soft, #7c8cff)',
                borderRadius: 999,
              }}
            />
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {fa(r.count)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) {
    return (
      <div className="card" style={{ color: 'var(--muted)', fontSize: 13.5 }}>
        {empty}
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: 'var(--muted)', textAlign: 'right' }}>
            {head.map((h) => (
              <th key={h} style={{ padding: '10px 13px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td
                  key={j}
                  style={{
                    padding: '9px 13px',
                    borderBottom: '1px solid var(--line)',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
