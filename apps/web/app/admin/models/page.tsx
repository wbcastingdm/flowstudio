'use client';

import { useEffect, useState } from 'react';

/**
 * لوکال: API روی پورتِ جدا (۳۲۰۰) است.
 * روی سرور: nginx مسیرِ /api را به همان کانتینر می‌فرستد ⇒ same-origin،
 * پس نه آدرسِ ثابت لازم است نه CORS.
 */
function apiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3200';
  }
  return '';
}

type AiModelRow = {
  id: string;
  modelKey: string;
  modality: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO';
  costPerUnit: number;
  maxDurationSec: number | null;
  acceptsSeed: boolean;
  cameraControl: string;
  commercialUse: boolean;
  regionReachable: string;
  provider: { id: string; name: string; baseUrl: string };
};

/**
 * درگاهِ نمونه — **ثبت‌نشده**. فقط فرم را پر می‌کند.
 * `registered` یعنی مالک قبلاً درگاهی با همین آدرس ساخته.
 */
type GatewayPreset = {
  key: string;
  title: string;
  baseUrl: string;
  summary: string;
  bearerAuth: boolean;
  stepTypes: string[];
  sampleModels: string[];
  registered: boolean;
};

/**
 * رازِ ادمین در `sessionStorage` می‌ماند، نه `localStorage` — با بستنِ تب
 * پاک می‌شود. روی مرورگرِ مشترک این تفاوت مهم است.
 */
const ADMIN_KEY = 'flowstudio_admin_key';

function adminFetch(path: string, key: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-admin-key', key);
  return fetch(`${apiBase()}${path}`, { ...init, headers });
}

export default function AdminModelsPage() {
  const [models, setModels] = useState<AiModelRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── درِ ورودیِ پنل ───
  const [adminKey, setAdminKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [gateNote, setGateNote] = useState('');

  const [providerName, setProviderName] = useState('');
  const [providerBaseUrl, setProviderBaseUrl] = useState('');
  const [providerApiKey, setProviderApiKey] = useState('');
  const [providerId, setProviderId] = useState('');
  const [modelKey, setModelKey] = useState('');
  const [modality, setModality] = useState<'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO'>('TEXT');
  const [costPerUnit, setCostPerUnit] = useState(0);
  const [commercialUse, setCommercialUse] = useState(true);
  const [acceptsSeed, setAcceptsSeed] = useState(false);
  // افزوده‌های سندِ ۸۱ — تاکسونومیِ گام‌ها از خودِ API می‌آید، نه فهرستِ تکراری.
  const [allStepTypes, setAllStepTypes] = useState<string[]>([]);
  const [presets, setPresets] = useState<GatewayPreset[]>([]);
  const [stepTypes, setStepTypes] = useState<string[]>([]);
  const [listPrice, setListPrice] = useState('');
  const [listCurrency, setListCurrency] = useState('USD');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function refresh(key = adminKey) {
    if (!key) return;
    try {
      const res = await fetch(`${apiBase()}/api/admin/models`, {
        headers: { 'x-admin-key': key },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setModels(await res.json());
      setError(null);
    } catch (e) {
      setError(`اتصال به API برقرار نشد (${apiBase()}) — ${String(e)}`);
    }
  }

  /** رازِ ذخیره‌شده را با یک درخواستِ واقعی می‌سنجد، نه با حدس. */
  async function tryUnlock(key: string, quiet = false) {
    if (!key) return false;
    try {
      const res = await fetch(`${apiBase()}/api/admin/models`, {
        headers: { 'x-admin-key': key },
      });
      if (res.ok) {
        setAdminKey(key);
        setUnlocked(true);
        setModels(await res.json());
        window.sessionStorage.setItem(ADMIN_KEY, key);
        void fetch(`${apiBase()}/api/admin/step-types`, { headers: { 'x-admin-key': key } })
          .then((r) => (r.ok ? r.json() : []))
          .then(setAllStepTypes)
          .catch(() => setAllStepTypes([]));
        void fetch(`${apiBase()}/api/admin/gateway-presets`, { headers: { 'x-admin-key': key } })
          .then((r) => (r.ok ? r.json() : []))
          .then(setPresets)
          .catch(() => setPresets([]));
        return true;
      }
      window.sessionStorage.removeItem(ADMIN_KEY);
      const body = await res.json().catch(() => ({}));
      if (!quiet) setGateNote(body?.message ?? `رد شد (HTTP ${res.status})`);
      return false;
    } catch (e) {
      if (!quiet) setGateNote(`اتصال برقرار نشد — ${String(e)}`);
      return false;
    }
  }

  useEffect(() => {
    const saved = window.sessionStorage.getItem(ADMIN_KEY);
    if (saved) void tryUnlock(saved, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!unlocked) {
    return (
      <main style={{ padding: '80px 22px', maxWidth: 460, margin: '0 auto' }}>
        <div className="pill">پنلِ مدیریت</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '10px 0 6px' }}>رمزِ پنل</h1>
        <p style={{ color: 'var(--muted)', margin: '0 0 22px', fontSize: 14, lineHeight: 1.9 }}>
          این پنل کلیدِ سرویس‌های هوشِ مصنوعی را نگه می‌دارد، پس روی دامنهٔ عمومی
          باز نمی‌ماند. رمز را مالک تعیین کرده است.
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
            placeholder="رمزِ پنل"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            autoFocus
          />
          <button className="btn btn-sm">ورود</button>
          {gateNote && <div style={{ color: '#e08a8a', fontSize: 14 }}>{gateNote}</div>}
        </form>
      </main>
    );
  }

  async function addProvider(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote('');
    try {
      const res = await adminFetch('/api/admin/providers', adminKey, {
        method: 'POST',
        body: JSON.stringify({ name: providerName, baseUrl: providerBaseUrl, apiKey: providerApiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setNote(`درگاه ساخته شد: ${data.id}`);
      setProviderId(data.id);
      setProviderName('');
      setProviderBaseUrl('');
      setProviderApiKey('');
    } catch (e) {
      setNote(`خطا: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function addModel(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote('');
    try {
      const res = await adminFetch('/api/admin/models', adminKey, {
        method: 'POST',
        body: JSON.stringify({
          providerId,
          modelKey,
          modality,
          costPerUnit,
          acceptsSeed,
          cameraControl: 'NONE',
          commercialUse,
          regionReachable: 'IRAN',
          stepTypes,
          // قیمتِ فهرستی اختیاری است؛ خالی یعنی هنوز از قیمت‌نامه درنیامده.
          listPricePerUnit: listPrice.trim() === '' ? null : Number(listPrice),
          listPriceCurrency: listPrice.trim() === '' ? null : listCurrency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setNote(`مدل اضافه شد: ${data.modelKey}`);
      setModelKey('');
      refresh();
    } catch (e) {
      setNote(`خطا: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: '50px 22px', maxWidth: 1000, margin: '0 auto' }}>
      <div className="pill">اسپرینتِ ۱ — لایهٔ درگاهِ AI</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '10px 0 6px' }}>رجیستریِ مدل‌ها</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 26px' }}>
        سرویس‌های هوشِ مصنوعی، مدل‌ها و قیمتِ واقعیِ هر مدل اینجا مدیریت می‌شود.
      </p>

      {error && (
        <div className="card" style={{ borderColor: '#a32f2f', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* ─── کاتالوگِ نمونه ───
          این‌ها **ثبت‌شده نیستند**؛ فقط فرمِ کناری را پر می‌کنند. تا کلیدِ
          واقعی زده نشود هیچ‌کدام در انتخابِ روتر شرکت نمی‌کنند. */}
      {presets.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <b className="card-title">درگاه‌های شناخته‌شده</b>
          <p className="meta" style={{ margin: '8px 0 14px' }}>
            روی هر کدام بزنی، فرمِ «درگاهِ جدید» با نام و آدرسش پر می‌شود — کلید را خودت
            می‌زنی. تا آن لحظه هیچ‌کدام ثبت نشده‌اند و چیزی عوض نمی‌شود.
          </p>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setProviderName(p.title);
                  setProviderBaseUrl(p.baseUrl);
                  setModelKey(p.sampleModels[0] ?? '');
                  setStepTypes(p.stepTypes);
                  setNote(
                    p.bearerAuth
                      ? `${p.title} — کلید را در همان فرم بزن.`
                      : `${p.title} — کلیدش داخلِ خودِ آدرس می‌رود، نه در هدر. آدرسِ کامل را بگذار و کلید را خالی.`,
                  );
                }}
                title={p.summary}
                className={p.registered ? 'tag tag-green' : 'tag'}
                style={{ cursor: 'pointer', fontSize: 14, padding: '8px 14px' }}
              >
                {p.title}
                {p.registered ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 26 }}>
        <form onSubmit={addProvider} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <b>درگاهِ جدید</b>
          <input placeholder="نام (مثلاً 9router)" value={providerName} onChange={(e) => setProviderName(e.target.value)} />
          <input placeholder="baseUrl" value={providerBaseUrl} onChange={(e) => setProviderBaseUrl(e.target.value)} />
          <input placeholder="apiKey" type="password" value={providerApiKey} onChange={(e) => setProviderApiKey(e.target.value)} />
          <button className="btn btn-sm" disabled={busy}>ساختِ درگاه</button>
        </form>

        <form onSubmit={addModel} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <b>مدلِ جدید</b>
          <input placeholder="providerId (از فرمِ کناری کپی کن)" value={providerId} onChange={(e) => setProviderId(e.target.value)} />
          <input placeholder="modelKey (مثلاً gpt-4o-mini)" value={modelKey} onChange={(e) => setModelKey(e.target.value)} />
          <select value={modality} onChange={(e) => setModality(e.target.value as any)}>
            <option value="TEXT">TEXT</option>
            <option value="IMAGE">IMAGE</option>
            <option value="AUDIO">AUDIO</option>
            <option value="VIDEO">VIDEO</option>
          </select>
          <input
            placeholder="هزینه (سکه)"
            type="number"
            value={costPerUnit}
            onChange={(e) => setCostPerUnit(Number(e.target.value))}
          />
          <label style={{ fontSize: 14 }}>
            <input type="checkbox" checked={commercialUse} onChange={(e) => setCommercialUse(e.target.checked)} /> مصرفِ تجاری مجاز
          </label>
          <label style={{ fontSize: 14 }}>
            <input type="checkbox" checked={acceptsSeed} onChange={(e) => setAcceptsSeed(e.target.checked)} /> پشتیبانیِ سید
          </label>

          {/* سندِ ۸۱ / D-O15 — قابلیتِ ریز. خالی بماند، روتر به modality می‌افتد. */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 2 }}>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 6 }}>
              گام‌هایی که این مدل اجرا می‌کند (اختیاری)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allStepTypes.map((s) => {
                const on = stepTypes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setStepTypes(on ? stepTypes.filter((x) => x !== s) : [...stepTypes, s])
                    }
                    style={{
                      fontSize: 13,
                      padding: '4px 9px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      direction: 'ltr',
                      border: `1px solid ${on ? 'var(--accent-line-2)' : 'var(--line)'}`,
                      background: on ? 'var(--accent-bg)' : 'transparent',
                      color: on ? 'var(--accent-soft)' : 'var(--muted)',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* سندِ ۸۱ / D-O14 — قیمتِ فهرستی؛ گزارش و CPAS، نه کسر از کیفِ پول. */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="قیمتِ فهرستیِ درگاه (اختیاری)"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              style={{ flex: 1 }}
            />
            <select value={listCurrency} onChange={(e) => setListCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="IRT">IRT</option>
            </select>
          </div>

          <button className="btn btn-sm" disabled={busy}>افزودنِ مدل</button>
        </form>
      </div>

      {note && <div className="card" style={{ marginBottom: 20 }}>{note}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)', textAlign: 'right' }}>
            <th style={{ padding: 8 }}>مدل</th>
            <th style={{ padding: 8 }}>نوع</th>
            <th style={{ padding: 8 }}>سرویس</th>
            <th style={{ padding: 8 }}>هزینه (سکه)</th>
            <th style={{ padding: 8 }}>مصرفِ تجاری</th>
            <th style={{ padding: 8 }}>سید</th>
          </tr>
        </thead>
        <tbody>
          {models?.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 16, color: 'var(--muted)', textAlign: 'center' }}>
                هنوز مدلی ثبت نشده — از فرمِ بالا شروع کن.
              </td>
            </tr>
          )}
          {models?.map((m) => (
            <tr key={m.id} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: 8 }}>{m.modelKey}</td>
              <td style={{ padding: 8 }}>{m.modality}</td>
              <td style={{ padding: 8 }}>{m.provider.name}</td>
              <td style={{ padding: 8 }}>{m.costPerUnit}</td>
              <td style={{ padding: 8 }}>{m.commercialUse ? '✓' : '—'}</td>
              <td style={{ padding: 8 }}>{m.acceptsSeed ? '✓' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
