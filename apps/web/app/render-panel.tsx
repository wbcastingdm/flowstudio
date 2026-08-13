'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiBase, apiFetch, getToken } from '@/lib/session';

/**
 * پنلِ تولیدِ زنده.
 *
 * کار را در صف می‌گذارد و بعد هر چند ثانیه وضعیتش را می‌پرسد تا کاربر ببیند
 * کدام نما ساخته شد. بدونِ این صفحه، کارگر کارش را می‌کند و هیچ‌کس نمی‌بیند —
 * و تعریفِ تمام‌شدنِ همان تسک این بود که «وضعیتش در رابطِ زنده به‌روز شود».
 *
 * 🔑 فایلِ خروجی با هدرِ `Authorization` گرفته و به `blob:` تبدیل می‌شود، نه
 * با گذاشتنِ توکن در آدرسِ `<video src>`. توکن در URL داخلِ تاریخچهٔ مرورگر و
 * لاگِ سرور و هدرِ Referer می‌نشیند؛ برایِ یک فایلِ چندمگابایتی این بها لازم
 * نیست.
 */

type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

interface RenderJob {
  id: string;
  status: JobStatus;
  lastError: string | null;
  shot: { id: string; order: number; description: string; durationSec: number; status: string };
  outputs: { id: string; engine: string; costActual: number }[];
}

interface RenderStatus {
  groupId: string;
  finalizedAt: string | null;
  finalAsset: { id: string; mimeType: string; byteSize: number; durationSec: number | null } | null;
  counts: Record<JobStatus, number>;
  totalJobs: number;
  totalSteps: number;
  doneSteps: number;
  progress: number;
  spentAmount: number;
  jobs: RenderJob[];
}

/**
 * برآورد پیش از ساخت — همان عددی که تصمیم می‌گیرد این پنل یک حرکت باشد یا دو.
 */
interface Estimate {
  shots: number;
  steps: number;
  durationSec: number;
  estimatedCoins: number;
}

/** وضعیت انتشار روی سایت عمومی — تنها مقصدی که امروز رابط فنی دارد. */
type PubStatus = 'DRAFT' | 'PUBLISHED' | 'PENDING_REVIEW' | 'WITHDRAWN';

interface PublicationRow {
  target: string;
  status: PubStatus;
  publishedAt: string | null;
  viewCount: number;
  blockers: { role: string; license: string; why: string }[];
}

const STATUS_FA: Record<JobStatus, { label: string; cls: string }> = {
  PENDING: { label: 'در صف', cls: 'tag' },
  RUNNING: { label: 'در حال ساخت', cls: 'tag tag-accent' },
  DONE: { label: 'آماده', cls: 'tag tag-green' },
  FAILED: { label: 'شکست خورد', cls: 'tag tag-red' },
};

function toFa(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

function humanSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${toFa(mb.toFixed(1))} مگابایت` : `${toFa(Math.round(bytes / 1024))} کیلوبایت`;
}

export function RenderPanel({
  projectId,
  title,
  autoStart = false,
}: {
  projectId: string;
  title: string;
  /**
   * 🔑 گاردریلِ ۵ — گیتِ انسانی پیش از خرجِ پول، نه بعد از آن.
   *
   * استودیو این را روشن می‌گذارد تا کاربر بعد از نوشتنِ ایده دکمهٔ دومی
   * نزند. ولی خودکار شدن **مشروط** است: فقط وقتی برآورد صفر سکه باشد.
   * روزی که یک گامِ پولی به زنجیره اضافه شود، برآورد از صفر درمی‌آید و
   * همین پنل خودش می‌ایستد و عدد را نشان می‌دهد — بدون یک خط تغییر این‌جا.
   */
  autoStart?: boolean;
}) {
  const [status, setStatus] = useState<RenderStatus | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const autoStartedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const fetchedAssetRef = useRef<string | null>(null);
  const [pub, setPub] = useState<PublicationRow | null>(null);
  const [pubBusy, setPubBusy] = useState(false);
  const [pubError, setPubError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await apiFetch(`/api/projects/${projectId}/render`);
    if (!res.ok) return;
    const data = await res.json();
    setStatus(data);
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * نظرسنجی فقط تا وقتی کاری در جریان است.
   *
   * ⚠️ بدونِ شرطِ توقف، این صفحه تا ابد هر سه ثانیه به API می‌زند — حتی وقتی
   * تبِ مرورگر ساعت‌ها باز مانده و همه‌چیز تمام شده.
   */
  useEffect(() => {
    if (!status) return;
    const working = status.counts.PENDING > 0 || status.counts.RUNNING > 0;
    if (!working) return;
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [status, refresh]);

  // فایلِ نهایی یک بار گرفته می‌شود؛ هر بار نظرسنجی نه.
  useEffect(() => {
    const assetId = status?.finalAsset?.id;
    if (!assetId || fetchedAssetRef.current === assetId) return;
    fetchedAssetRef.current = assetId;

    void (async () => {
      const res = await fetch(`${apiBase()}/api/assets/${assetId}/file`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      setVideoUrl(URL.createObjectURL(await res.blob()));
    })();
  }, [status?.finalAsset?.id]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  /**
   * وضعیت انتشار فقط وقتی معنا دارد که فایلی وجود داشته باشد — پیش از آن
   * API هم انتشار را رد می‌کند. پس پرسیدنش را به همان لحظه گره می‌زنیم.
   */
  const refreshPub = useCallback(async () => {
    const res = await apiFetch(`/api/publications/${projectId}`);
    if (!res.ok) return;
    const data = await res.json();
    setPub(data.targets?.find((t: PublicationRow) => t.target === 'PUBLIC_SITE') ?? null);
  }, [projectId]);

  useEffect(() => {
    if (!status?.finalAsset) return;
    void refreshPub();
  }, [status?.finalAsset, refreshPub]);

  async function togglePublish(publish: boolean) {
    setPubBusy(true);
    setPubError(null);
    try {
      const res = await apiFetch(
        `/api/publications/${projectId}/${publish ? 'publish' : 'withdraw'}`,
        { method: 'POST', body: JSON.stringify({ target: 'PUBLIC_SITE' }) },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      await refreshPub();
    } catch (err) {
      setPubError(String(err instanceof Error ? err.message : err));
    } finally {
      setPubBusy(false);
    }
  }

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/render`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setStatus(data);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  // برآورد فقط تا وقتی چیزی صف نشده معنا دارد.
  useEffect(() => {
    if (status) return;
    let alive = true;
    void apiFetch(`/api/projects/${projectId}/render/estimate`)
      .then((r) => (r.ok ? r.json() : null))
      .then((e) => alive && setEstimate(e))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [projectId, status]);

  useEffect(() => {
    if (!autoStart || status || autoStartedRef.current) return;
    // ⚠️ شرطِ صریحِ صفر، نه «کوچک یا مساویِ صفر» و نه «falsy» — برآوردِ
    // نیامده هم falsy است و نباید کار را خودکار روی صف بگذارد.
    if (!estimate || estimate.estimatedCoins !== 0) return;
    autoStartedRef.current = true;
    void start();
  }, [autoStart, status, estimate, start]);

  const working = status ? status.counts.PENDING > 0 || status.counts.RUNNING > 0 : false;

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="card-title">ساخت فایل</span>
        <span style={{ flex: 1 }} />
        {!status && !(autoStart && estimate?.estimatedCoins === 0) && (
          <button type="button" className="btn btn-sm" onClick={start} disabled={busy}>
            {busy
              ? 'در حال فرستادن…'
              : estimate && estimate.estimatedCoins > 0
                ? `تأیید و بساز — ${toFa(estimate.estimatedCoins)} سکه`
                : 'بساز'}
          </button>
        )}
        {status && !working && !status.finalAsset && (
          <button type="button" className="btn btn-sm" onClick={start} disabled={busy}>
            تلاش دوباره
          </button>
        )}
      </div>

      {!status && (
        <p className="meta" style={{ marginTop: 10 }}>
          {estimate && estimate.estimatedCoins > 0 ? (
            <>
              این پلان {toFa(estimate.shots)} نما و {toFa(estimate.steps)} گام دارد و{' '}
              <b>{toFa(estimate.estimatedCoins)} سکه</b> خرج می‌کند. تا تأیید نکنی هیچ سکه‌ای
              برداشته نمی‌شود.
            </>
          ) : (
            <>
              از هر نما یک کلیپ ساخته می‌شود و آخرش همه به یک فایل می‌چسبند. این مسیر هیچ
              مدل هوش مصنوعی صدا نمی‌زند، پس هزینه‌اش صفر سکه است.
            </>
          )}
        </p>
      )}

      {error && (
        <div className="note note-red" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {status && (
        <div style={{ marginTop: 16 }}>
          <div className="tags" style={{ marginBottom: 10 }}>
            <span className="tag tag-accent">
              {toFa(status.progress)}٪ — {toFa(status.doneSteps)} از {toFa(status.totalSteps)} گام
            </span>
            <span className="tag">{toFa(status.totalJobs)} نما</span>
            <span className="tag">{toFa(status.spentAmount)} سکه خرج شد</span>
            {working && <span className="tag tag-amber">در حال کار…</span>}
          </div>

          <div className="bar">
            <div className="bar-fill" style={{ width: `${status.progress}%` }} />
          </div>

          <div style={{ marginTop: 14 }}>
            {status.jobs.map((job, index) => {
              const s = STATUS_FA[job.status];
              // شمارهٔ نما در کلِ فیلم، نه در سکانسش: `shot.order` هر سکانس
              // از یک شروع می‌شود و این‌جا دو بار «۱» نشان می‌داد. ترتیبِ
              // کارها همان ترتیبِ روایت است، پس اندیس درست است.
              return (
                <div key={job.id} className="row">
                  <div className="row-num">{toFa(index + 1)}</div>
                  <div className="row-body">
                    <div className="row-title">{job.shot.description}</div>
                    <div className="tags" style={{ marginTop: 8 }}>
                      <span className={s.cls}>{s.label}</span>
                      <span className="tag">{toFa(job.shot.durationSec)} ثانیه</span>
                      {job.outputs.length > 0 && (
                        <span className="tag">{toFa(job.outputs.length)} خروجی</span>
                      )}
                    </div>
                    {job.lastError && (
                      <div className="note note-red" style={{ marginTop: 9 }}>
                        {job.lastError}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {status.finalAsset && (
            <div style={{ marginTop: 18 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>
                فایل نهایی — {title}
              </div>
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  style={{
                    // ویدیو ۹:۱۶ است؛ با عرضِ بیشتر، ارتفاعش کلِ صفحه را
                    // می‌گیرد و دکمهٔ دانلود زیرِ خطِ دید می‌افتد.
                    width: 'min(240px, 100%)',
                    borderRadius: 12,
                    border: '1px solid var(--line)',
                    background: '#000',
                    display: 'block',
                  }}
                />
              ) : (
                <div className="meta">در حال گرفتن فایل…</div>
              )}
              <div className="tags" style={{ marginTop: 10 }}>
                <span className="tag tag-green">
                  {toFa(status.finalAsset.durationSec ?? 0)} ثانیه
                </span>
                <span className="tag">{humanSize(status.finalAsset.byteSize)}</span>
                {videoUrl && (
                  <a
                    className="btn btn-sm"
                    href={videoUrl}
                    download={`${title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 40) || 'flowstudio'}.mp4`}
                  >
                    دانلود
                  </a>
                )}
              </div>

              <div
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {pub?.status === 'PUBLISHED' ? (
                  <>
                    <span className="tag tag-green">عمومی شده</span>
                    <a className="btn btn-sm" href={`/w/${projectId}`}>
                      صفحه عمومی
                    </a>
                    <span className="tag">{toFa(pub.viewCount)} بازدید</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => togglePublish(false)}
                      disabled={pubBusy}
                    >
                      {pubBusy ? 'صبر کن…' : 'برداشتن'}
                    </button>
                  </>
                ) : pub?.status === 'PENDING_REVIEW' ? (
                  <span className="tag tag-amber">در انتظار بازبینی راهبر</span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => togglePublish(true)}
                      disabled={pubBusy}
                    >
                      {pubBusy ? 'صبر کن…' : 'عمومی کن'}
                    </button>
                    <span className="meta" style={{ fontSize: 13.5 }}>
                      روی صفحه «کارهای منتشرشده» دیده می‌شود و هر کسی می‌تواند تماشا کند.
                    </span>
                  </>
                )}
              </div>

              {pubError && (
                <div className="note note-red" style={{ marginTop: 10 }}>
                  {pubError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
