'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiBase, apiFetch, getToken } from '@/lib/session';
import { UserBar } from '../user-bar';
import { RenderPanel } from '../render-panel';

// ─── قرارداد رجیستری ───
// هیچ فهرستی این‌جا ثابت نوشته نمی‌شود. نوع تولید، زیرشاخه‌هایش و سطوح خدمت
// همه از API می‌آیند، وگرنه روزی که نوعی اضافه شود این صفحه از آن بی‌خبر می‌ماند.

type TypeField = {
  key: string;
  label: string;
  kind: 'select' | 'text' | 'number';
  required?: boolean;
  options?: { value: string; label: string }[];
};

type ProductionType = {
  key: string;
  title: string;
  description: string | null;
  minDurationSec: number;
  maxDurationSec: number;
  fieldSchema: TypeField[];
};

type ServiceTier = {
  key: string;
  title: string;
  coinAllowance: number;
  maxDurationSec: number;
  watermark: boolean;
  priceIrt: number | null;
};

type Direction = {
  miseEnScene: string | null;
  shotSize: string | null;
  cameraAngle: string | null;
  lighting: string | null;
  colorMood: string | null;
  cameraMovement: string | null;
  origins: Record<string, 'USER' | 'MACHINE'>;
};

type Shot = {
  id: string;
  order: number;
  durationSec: number;
  description: string;
  cameraMovement: string;
  direction: Direction | null;
};

type Sequence = { id: string; order: number; title: string; shots: Shot[] };

type Result = {
  project: { id: string; title: string; sequences: Sequence[] };
  modelUsed: string;
  providerUsed: string;
  costActual: number;
  /** `local` یعنی هیچ مدلی صدا زده نشد — کاربر باید این را بداند. */
  planner?: 'model' | 'local';
};

type UploadedAsset = {
  id: string;
  kind: string;
  role: string;
  byteSize: number;
  name: string;
  /** پیش‌نمایش از خود فایل مرورگر ساخته می‌شود، بدون رفت‌وبرگشت به سرور. */
  previewUrl?: string;
};

const MATERIALS = [
  ['REAL', 'واقعی و زنده'],
  ['ANIME', 'انیمه'],
  ['COMIC', 'کمیک'],
  ['FANTASY', 'فانتزی'],
  ['THREE_D', 'سه بعدی'],
  ['STOP_MOTION', 'استاپ موشن'],
] as const;

const SHOT_SIZE_FA: Record<string, string> = {
  EXTREME_WIDE: 'خیلی باز',
  WIDE: 'باز',
  MEDIUM: 'متوسط',
  CLOSE_UP: 'نزدیک',
  EXTREME_CLOSE_UP: 'خیلی نزدیک',
};

const ANGLE_FA: Record<string, string> = {
  EYE_LEVEL: 'هم‌سطح چشم',
  LOW: 'از پایین',
  HIGH: 'از بالا',
  OVERHEAD: 'از فراز',
  DUTCH: 'کج',
};

const MOVE_FA: Record<string, string> = {
  STATIC: 'ثابت',
  PAN: 'پن',
  TILT: 'تیلت',
  DOLLY: 'دالی',
  HANDHELD: 'روی دست',
  COMBINED: 'ترکیبی',
};

/** رقم لاتین وسط متن فارسی جهت خواندن را می‌شکند. */
function toFa(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/** ثانیه را به شکل خوانا می‌نویسد — چون مدت تا ساعت می‌رود. */
function humanDuration(sec: number): string {
  if (sec < 60) return `${toFa(sec)} ثانیه`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${toFa(m)} دقیقه و ${toFa(s)} ثانیه` : `${toFa(m)} دقیقه`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m ? `${toFa(h)} ساعت و ${toFa(m)} دقیقه` : `${toFa(h)} ساعت`;
}

/** گام‌های پیشنهادی مدت، متناسب با بازه همان نوع تولید. */
function durationChoices(min: number, max: number): number[] {
  const all = [6, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
  const inRange = all.filter((d) => d >= min && d <= max);
  if (!inRange.includes(min)) inRange.unshift(min);
  if (!inRange.includes(max) && inRange.length < 8) inRange.push(max);
  return inRange;
}

/**
 * پیش‌فرضِ زیرشاخه‌های یک نوع.
 *
 * 🔑 هر فیلدِ انتخابی گزینهٔ اولش را از پیش می‌گیرد. بدونِ این، فیلدِ
 * انتخابیِ اجباری در کشوی بستهٔ «تنظیم دقیق‌تر» می‌ماند و کاربر خطای
 * «این فیلد لازم است» می‌گیرد بدونِ اینکه ببیند کجاست. فیلدِ متنی پیش‌فرض
 * نمی‌گیرد — حدسِ ما به‌جای کاربر روی تصویر می‌نشیند.
 */
function defaultAttributes(type: ProductionType | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of type?.fieldSchema ?? []) {
    if (f.kind === 'select' && f.options?.length) out[f.key] = f.options[0].value;
  }
  return out;
}

export default function StudioPage() {
  const router = useRouter();

  const [types, setTypes] = useState<ProductionType[] | null>(null);
  const [tiers, setTiers] = useState<ServiceTier[]>([]);
  const [typeKey, setTypeKey] = useState<string>('');
  const [tierKey, setTierKey] = useState<string>('');

  const [rawIdea, setRawIdea] = useState('');
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [material, setMaterial] = useState<string>('REAL');
  const [fidelity, setFidelity] = useState(70);
  const [durationSec, setDurationSec] = useState(30);

  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const scriptRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const clipRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!getToken()) router.push('/login?next=/studio');
  }, [router]);

  useEffect(() => {
    fetch(`${apiBase()}/api/registry/production-types`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: ProductionType[]) => {
        setTypes(list);
        if (list.length > 0) {
          setTypeKey(list[0].key);
          setAttributes(defaultAttributes(list[0]));
          setDurationSec(durationChoices(list[0].minDurationSec, list[0].maxDurationSec)[0]);
        }
      })
      .catch(() => setTypes([]));

    fetch(`${apiBase()}/api/registry/service-tiers`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setTiers)
      .catch(() => setTiers([]));
  }, []);

  const type = useMemo(() => types?.find((t) => t.key === typeKey) ?? null, [types, typeKey]);
  const tier = useMemo(() => tiers.find((t) => t.key === tierKey) ?? null, [tiers, tierKey]);

  /** با عوض شدن نوع، زیرشاخه‌های نوع قبلی باید پاک شوند. */
  const pickType = useCallback(
    (key: string) => {
      setTypeKey(key);
      setResult(null);
      setError(null);
      const t = types?.find((x) => x.key === key);
      setAttributes(defaultAttributes(t));
      if (t) {
        const choices = durationChoices(t.minDurationSec, t.maxDurationSec);
        setDurationSec(choices[0]);
      }
    },
    [types],
  );

  async function uploadFile(file: File, kind: string, role: string) {
    setUploading(role);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      form.append('role', role);
      const res = await fetch(`${apiBase()}/api/assets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      const previewUrl = kind === 'IMAGE' ? URL.createObjectURL(file) : undefined;
      setAssets((prev) => [...prev, { ...data, name: file.name, previewUrl }]);
      // فیلمنامه آپلودشده مستقیم داخل کادر ایده می‌نشیند تا کاربر ببیند
      // سیستم چه چیزی خوانده — نه اینکه فایل در تاریکی بماند.
      if (data.extractedText) setRawIdea((prev) => (prev.trim() ? prev : data.extractedText));
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setUploading(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          rawIdea,
          productionType: typeKey,
          attributes,
          targetDurationSec: durationSec,
          materialStyle: material,
          materialFidelity: fidelity,
          ...(tierKey ? { serviceTier: tierKey } : {}),
        }),
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

  const resultShots = result?.project.sequences.flatMap((s) => s.shots) ?? [];
  const totalDuration = resultShots.reduce((n, s) => n + s.durationSec, 0);
  const shotCount = resultShots.length;

  return (
    <main style={{ padding: '40px 22px', maxWidth: 1000, margin: '0 auto' }}>
      <UserBar active="studio" />
      <div className="pill">استودیو تولید · از ایده تا فایل · رایگان</div>
      <h1 className="page-title">ایده را بنویس، فایل بگیر</h1>

      {/*
        سه حرکت، صریح و شمرده. بدون این ردیف، کاربر نمی‌داند چند قدم مانده و
        هر فیلدِ اضافه شبیهِ یک قدمِ دیگر به نظر می‌رسد.
      */}
      <div className="steps-rail">
        {['ایده‌ات را بنویس', 'بساز را بزن', 'تماشا کن یا منتشر کن'].map((label, i) => (
          <span key={label} className={`steps-rail-item${result && i === 0 ? ' is-done' : ''}`}>
            <b>{toFa(i + 1)}</b>
            {label}
          </span>
        ))}
      </div>

      {types !== null && types.length === 0 && (
        <div className="note note-red">
          هیچ نوع تولیدی فعال نیست. از پنل مدیریت دست کم یکی را روشن کن.
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/*
          ── یک جعبه: نوع، ایده، فایل‌ها، مدت ──
          پیش‌تر این‌ها چهار کارتِ شماره‌دار بودند و همه هم‌زمان باز. چهار قابِ
          جدا یعنی چهار تصمیمِ ظاهراً واجب، در حالی که فقط یکی‌شان واقعاً از
          کاربر چیزی می‌خواهد: خودِ ایده.
        */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {(types ?? []).map((t) => {
              const on = t.key === typeKey;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => pickType(t.key)}
                  style={{
                    padding: '10px 17px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 14.5,
                    textAlign: 'right',
                    border: `1px solid ${on ? 'var(--accent-line-2)' : 'var(--line)'}`,
                    background: on ? 'var(--accent-bg)' : 'var(--surface-2)',
                    color: on ? 'var(--accent-soft)' : 'var(--muted)',
                    fontWeight: on ? 800 : 500,
                  }}
                >
                  {t.title}
                </button>
              );
            })}
          </div>
          <textarea
            value={rawIdea}
            onChange={(e) => setRawIdea(e.target.value)}
            autoFocus
            placeholder="به زبان خودت بنویس. از چند خط تا چند صفحه — هر چه دقیق‌تر، خروجی نزدیک‌تر."
            rows={7}
            style={{ fontSize: 15.5, lineHeight: 2, resize: 'vertical', padding: 15 }}
          />

          {/* مدت کنارِ ایده می‌ماند، نه در کشو: تنها چیزی جز خودِ ایده که
              کاربر واقعاً عوضش می‌کند. */}
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, flexWrap: 'wrap' }}
          >
            <span style={{ color: 'var(--muted)' }}>مدت</span>
            <select
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
              style={{ maxWidth: 190 }}
            >
              {durationChoices(type?.minDurationSec ?? 6, type?.maxDurationSec ?? 60).map((d) => (
                <option key={d} value={d}>
                  {humanDuration(d)}
                </option>
              ))}
            </select>
            {type?.description && <span className="meta">{type.description}</span>}
          </label>

          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              ref={scriptRef}
              type="file"
              accept=".txt,.md,text/plain"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f, 'TEXT', 'input_script');
                e.target.value = '';
              }}
            />
            <input
              ref={imageRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f, 'IMAGE', 'reference_image');
                e.target.value = '';
              }}
            />
            <input
              ref={clipRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f, 'CLIP', 'base_clip');
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={!!uploading}
              onClick={() => scriptRef.current?.click()}
            >
              {uploading === 'input_script' ? 'در حال آپلود…' : 'فایل متنی'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={!!uploading}
              onClick={() => imageRef.current?.click()}
            >
              {uploading === 'reference_image' ? 'در حال آپلود…' : 'عکس مرجع'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={!!uploading}
              onClick={() => clipRef.current?.click()}
            >
              {uploading === 'base_clip' ? 'در حال آپلود…' : 'کلیپ پایه'}
            </button>
            <span className="meta">متن تا ۲ مگابایت · عکس تا ۱۵ · کلیپ تا ۲۰۰</span>
          </div>

          {assets.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {assets.map((a) => (
                <span
                  key={a.id}
                  className="chip"
                  style={{
                    padding: a.previewUrl ? '5px 5px 5px 12px' : '6px 12px',
                    fontSize: 13.5,
                    direction: 'rtl',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 9,
                  }}
                >
                  {a.previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.previewUrl}
                      alt={a.name}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 7,
                        objectFit: 'cover',
                        border: '1px solid var(--line)',
                      }}
                    />
                  )}
                  <span>
                    {a.name} · {toFa(Math.max(1, Math.round(a.byteSize / 1024)))} کیلوبایت
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/*
          ── کشوی تنظیم دقیق‌تر ──
          🔑 هر چیزی که پیش‌فرضِ قابلِ دفاع دارد این‌جاست، نه جلوی چشم. هیچ‌کدام
          از این‌ها برای گرفتنِ اولین فایل لازم نیست؛ گذاشتنشان در مسیرِ اصلی
          فقط کاربر را وادار می‌کرد دربارهٔ چیزی تصمیم بگیرد که هنوز خروجی‌اش
          را ندیده.
        */}
        <details className="tune">
          <summary>تنظیم دقیق‌تر — اختیاری</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 14 }}>
            {type && type.fieldSchema.length > 0 && (
              <div className="grid-fields">
              {type.fieldSchema.map((f) => (
                <label key={f.key} className="field-row">
                  <span className="field-name">
                    {f.label}
                    {f.required ? <span style={{ color: 'var(--amber)' }}> *</span> : ''}
                  </span>
                  {f.kind === 'select' ? (
                    <select
                      value={attributes[f.key] ?? ''}
                      onChange={(e) =>
                        setAttributes((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                    >
                      <option value="">— انتخاب کن —</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.kind === 'number' ? 'number' : 'text'}
                      value={attributes[f.key] ?? ''}
                      onChange={(e) =>
                        setAttributes((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                    />
                  )}
                  </label>
                ))}
              </div>
            )}

            <div className="grid-fields">
              <label className="field-row">
                <span className="field-name">جنس تصویر</span>
                <select value={material} onChange={(e) => setMaterial(e.target.value)}>
                  {MATERIALS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-row">
                <span className="field-name">نزدیکی به این جنس: {toFa(fidelity)}٪</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={fidelity}
                  onChange={(e) => setFidelity(Number(e.target.value))}
                />
              </label>

              {tiers.length > 0 && (
                <label className="field-row">
                  <span className="field-name">سطح خدمت</span>
                  <select value={tierKey} onChange={(e) => setTierKey(e.target.value)}>
                    <option value="">— بدون سطح (آزمایشی) —</option>
                    {tiers.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {tier && (
              <div className="meta">
                {tier.title}: تا {humanDuration(tier.maxDurationSec)} · سقف{' '}
                {toFa(tier.coinAllowance)} سکه
                {tier.watermark ? ' · با واترمارک' : ' · بدون واترمارک'}
                {tier.priceIrt == null
                  ? ' · قیمت هنوز تعیین نشده'
                  : ` · ${toFa(tier.priceIrt)} تومان`}
                {durationSec > tier.maxDurationSec && (
                  <span style={{ color: 'var(--red)' }}>
                    {' '}
                    — مدت انتخابی از سقف این سطح بیشتر است
                  </span>
                )}
              </div>
            )}
          </div>
        </details>

        {/*
          یک دکمه، نه دو. شات‌لیست و رندر پشتِ هم می‌روند و کاربر بینشان
          دکمهٔ دومی نمی‌زند — مگر آن روز که پلان سکه بخواهد؛ آن وقت خودِ
          پنل می‌ایستد و تأیید می‌خواهد (گاردریلِ ۵).
        */}
        <button
          className="btn"
          disabled={busy || !rawIdea.trim() || !typeKey}
          style={{ alignSelf: 'flex-start' }}
        >
          {busy ? 'در حال ساخت…' : 'بساز'}
        </button>
      </form>

      {error && (
        <div className="card" style={{ borderColor: 'var(--red-line)', marginTop: 20 }}>
          <b style={{ color: 'var(--red)', fontSize: 15.5 }}>ساخته نشد</b>
          <p className="meta-strong" style={{ margin: '9px 0 0' }}>
            {error}
          </p>
          {error.includes('مدل') && (
            <p className="meta" style={{ margin: '10px 0 0' }}>
              اگر می‌گوید هیچ مدل متنی ثبت نشده: اول از{' '}
              <a href="/admin/models">پنل رجیستری مدل‌ها</a> یک درگاه با کلید واقعی اضافه کن.
            </p>
          )}
        </div>
      )}

      {result && (
        <section style={{ marginTop: 30 }}>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}
          >
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{result.project.title}</h2>
            <span className="tag">{humanDuration(totalDuration)}</span>
            <span className="tag">{toFa(shotCount)} نما</span>
            <span className="tag">هزینه: {toFa(result.costActual)} سکه</span>
          </div>

          {result.planner === 'local' ? (
            <div className="note note-amber" style={{ marginBottom: 14 }}>
              <b>این شات‌لیست را مدل زبانی ننوشته.</b> هنوز هیچ کلید درگاهی ثبت نشده، پس متن
              با یک قاعده محلی به نما شکسته شد — بدون هیچ فراخوان بیرونی و بدون هیچ هزینه.
              به‌محض ثبت یک کلید واقعی در <a href="/admin/models">پنل مدل‌ها</a>، همین دکمه
              خروجی مدل می‌دهد.
            </div>
          ) : (
            <div className="meta" style={{ marginBottom: 14 }}>
              نوشته {result.modelUsed} از {result.providerUsed} · عناصر نشان‌دار پیشنهاد سیستم‌اند،
              چون در متن تو نبودند.
            </div>
          )}

          {/* پنل بالای شات‌لیست است: چیزی که کاربر منتظرش است فایل است، نه
              فهرستِ نماها. فهرست زیرش می‌ماند برای وقتی بخواهد بداند چه
              ساخته می‌شود. */}
          <RenderPanel projectId={result.project.id} title={result.project.title} autoStart />

          <details className="tune" style={{ marginTop: 18 }}>
            <summary>شات‌لیست — {toFa(shotCount)} نما</summary>
            <div style={{ paddingTop: 14 }}>
              {result.project.sequences.map((seq) => (
                <div key={seq.id} style={{ marginBottom: 20 }}>
                  <div className="meta-strong" style={{ marginBottom: 9 }}>
                    سکانس {toFa(seq.order)} — {seq.title}
                  </div>
                  {seq.shots.map((shot) => (
                    <ShotCard key={shot.id} shot={shot} />
                  ))}
                </div>
              ))}
            </div>
          </details>
        </section>
      )}
    </main>
  );
}

/** یک نما با عناصر کارگردانی‌اش. پیشنهاد ماشین نشان‌دار است. */
function ShotCard({ shot }: { shot: Shot }) {
  const d = shot.direction;
  const origins = d?.origins ?? {};

  const items: { key: string; label: string; value: string | null }[] = [
    { key: 'cameraMovement', label: 'دوربین', value: MOVE_FA[shot.cameraMovement] ?? shot.cameraMovement },
    { key: 'shotSize', label: 'اندازه نما', value: d?.shotSize ? SHOT_SIZE_FA[d.shotSize] ?? d.shotSize : null },
    { key: 'cameraAngle', label: 'زاویه', value: d?.cameraAngle ? ANGLE_FA[d.cameraAngle] ?? d.cameraAngle : null },
    { key: 'lighting', label: 'نور', value: d?.lighting ?? null },
    { key: 'colorMood', label: 'رنگ', value: d?.colorMood ?? null },
  ];

  return (
    <div className="row">
      <div className="row-num">{toFa(shot.order)}</div>
      <div className="row-body">
        <div className="row-title">{shot.description}</div>

        {d?.miseEnScene && (
          <div
            style={{
              marginTop: 10,
              fontSize: 14,
              color: 'var(--muted)',
              lineHeight: 1.9,
              paddingInlineStart: 11,
              borderInlineStart: `2px solid ${
                origins.miseEnScene === 'MACHINE' ? 'var(--accent-soft)' : 'var(--line)'
              }`,
            }}
          >
            <span style={{ color: 'var(--dim)' }}>میزان‌سن: </span>
            {d.miseEnScene}
          </div>
        )}

        <div className="tags" style={{ marginTop: 10 }}>
          <span className="tag">{toFa(shot.durationSec)} ثانیه</span>
          {items
            .filter((i) => i.value)
            .map((i) => (
              <span
                key={i.key}
                className={origins[i.key] === 'MACHINE' ? 'tag tag-accent' : 'tag'}
                title={origins[i.key] === 'MACHINE' ? 'پیشنهاد سیستم' : 'نوشته خودت'}
              >
                {i.label}: {i.value}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
