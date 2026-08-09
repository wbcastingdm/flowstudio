import type { Metadata } from 'next';

/**
 * صفحهٔ نمایشِ پروبِ «مسیر ج» — سندِ ۸۱، بندِ «آنچه اول انجام شود» ۲.
 * عمداً سِروِری و بدونِ حالت است: فقط چیزی که ساخته شد را نشان می‌دهد،
 * با عددهای اندازه‌گیری‌شده نه ادعا. فایل‌ها در `public/lab/motion/`.
 */

export const metadata: Metadata = {
  title: 'آزمایشگاه — مسیرِ ج: تصویرِ ثابت + حرکتِ برنامه‌ای',
  robots: { index: false, follow: false },
};

const BASE = '/lab/motion';

const CLIPS = [
  {
    file: 'out-still.mp4',
    name: 'بی‌حرکت',
    preset: 'still',
    cpu: 25.6,
    size: '۵۹۵KB',
    note: 'پایهٔ مقایسه — تا معلوم شود هزینهٔ خودِ حرکت چقدر است',
  },
  {
    file: 'out-pan_rl.mp4',
    name: 'حرکتِ افقی',
    preset: 'pan_rl',
    cpu: 34.1,
    size: '۱٫۵MB',
    note: 'از راست به چپ، هم‌جهت با خواندنِ فارسی',
  },
  {
    file: 'out-kenburns_in.mp4',
    name: 'نزدیک‌شدنِ آرام',
    preset: 'kenburns_in',
    cpu: 45.4,
    size: '۲٫۱MB',
    note: 'کارِ نمای لوگو و عنوان — بزرگ‌نمایی ۱٫۰۰ تا ۱٫۱۲',
  },
  {
    file: 'out-push_diagonal.mp4',
    name: 'فشارِ مورب',
    preset: 'push_diagonal',
    cpu: 45.3,
    size: '۲٫۲MB',
    note: 'حسِ سه‌بعدیِ ارزان روی نمای محصول',
  },
  {
    file: 'out-full.mp4',
    name: 'نزدیک‌شدن + دانه + وینیت',
    preset: 'kenburns_in --grain --vignette',
    cpu: 61.7,
    size: '۲٫۷MB',
    note: 'دانهٔ تصویری ثابت‌بودنِ منبع را کمتر لو می‌دهد',
  },
];

const FILTER =
  "scale=2160:3840:force_original_aspect_ratio=increase:flags=lanczos,crop=2160:3840," +
  "zoompan=z='1+(1.12-1)*on/239':x='(iw-iw/zoom)*(0.5)':y='(ih-ih/zoom)*(0.5)'" +
  ':d=240:s=1080x1920:fps=30,fade=t=in:st=0:d=0.4,fade=t=out:st=7.6:d=0.4,format=yuv420p';

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <pre
      style={{
        direction: 'ltr',
        textAlign: 'left',
        background: 'var(--input)',
        border: '1px solid var(--line)',
        borderRadius: 10,
        padding: 14,
        fontSize: 12,
        lineHeight: 1.75,
        overflowX: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'var(--muted)',
      }}
    >
      {children}
    </pre>
  );
}

export default function MotionLabPage() {
  return (
    <main style={{ padding: '40px 22px', maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 16, paddingBottom: 14, marginBottom: 26, borderBottom: '1px solid var(--line)' }}>
        <a href="/studio" style={{ fontSize: 13.5, color: 'var(--muted)' }}>استودیو</a>
        <a href="/library" style={{ fontSize: 13.5, color: 'var(--muted)' }}>کتابخانهٔ من</a>
        <a href="/app" style={{ fontSize: 13.5, color: 'var(--muted)' }}>وضعیتِ مراحل</a>
        <span style={{ fontSize: 13.5, color: 'var(--accent)', fontWeight: 700 }}>آزمایشگاه</span>
      </div>

      <div className="pill">سندِ ۸۱ — مسیرِ ج از جدولِ زنجیره‌ها</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: '12px 0 10px' }}>
        تصویرِ ثابت + حرکتِ برنامه‌ای
      </h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 10px', lineHeight: 2, maxWidth: '64ch' }}>
        این ویدیوها <b>بدونِ هیچ فراخوانِ هوشِ مصنوعی</b> ساخته شده‌اند. نه مدلِ ویدیو،
        نه مدلِ تصویر، نه یک ریال هزینهٔ درگاه. نمای پایه از HTML رندر شده و حرکت را
        ffmpeg ساخته است.
      </p>
      <p style={{ color: 'var(--muted)', margin: '0 0 30px', lineHeight: 2, maxWidth: '64ch' }}>
        هدف از این پروب، پرکردنِ یک ردیف از جدولِ هزینهٔ زنجیره‌های سندِ ۸۱ با
        <b> عددِ واقعی</b> بود، نه حدس. همهٔ اعدادِ زیر روی سرورِ تولید
        اندازه‌گیری شده‌اند (Xeon E5-2670 v2، تک‌نخ)، نه روی مک.
      </p>

      {/* ─── نمای پایه ─── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 8px' }}>
          ۱) نمای پایه — از HTML، نه از مدلِ تصویر
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.95, margin: '0 0 16px', maxWidth: '64ch' }}>
          یافتهٔ پیش‌بینی‌نشدهٔ این پروب: <b>هیچ مدلِ تصویری متنِ فارسی را قابلِ
          اتکا نمی‌نویسد</b>، ولی کرومِ headless از یک فایلِ HTML همان کادر را با
          چسبشِ درستِ حروف، راست‌به‌چپ، اعراب و نیم‌فاصله می‌سازد — در ۱٫۲۴ ثانیهٔ CPU.
          پس برایِ نمای لوگو، عنوان، قیمت و تماس، این زنجیره هم ارزان‌تر است هم بهتر.
        </p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <a href={`${BASE}/still.png`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BASE}/still.png`}
              alt="نمای پایه"
              style={{ width: 220, borderRadius: 12, border: '1px solid var(--line)', display: 'block' }}
            />
          </a>
          <div style={{ flex: 1, minWidth: 280 }}>
            <Mono>
{`"Google Chrome" --headless --disable-gpu \\
  --screenshot=still.png --window-size=1080,1920 \\
  file://still.html

⇒ 987,893 bytes · 1080x1920 · 1.24s CPU`}
            </Mono>
            <p style={{ fontSize: 12.5, color: 'var(--dim)', margin: '4px 0 0' }}>
              منبعِ HTML: <a href={`${BASE}/still-source.html`} target="_blank" rel="noreferrer">still-source.html</a>
            </p>
          </div>
        </div>
      </section>

      {/* ─── ویدیوها ─── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 8px' }}>۲) خروجی‌ها</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '0 0 18px' }}>
          هر کدام ۸ ثانیه · ۱۰۸۰×۱۹۲۰ · ۳۰fps · H.264
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 18,
          }}
        >
          {CLIPS.map((c) => (
            <div key={c.file} className="card" style={{ padding: 14 }}>
              <video
                src={`${BASE}/${c.file}`}
                // بدونِ پوستر، کارت تا اولین پخش مشکیِ خالی است. همان نمای پایه
                // را می‌گذاریم — مرورگر یک بار می‌گیردش و برای هر پنج کارت کش می‌شود.
                poster={`${BASE}/still.png`}
                controls
                loop
                muted
                playsInline
                preload="metadata"
                style={{
                  width: '100%',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: '#000',
                  display: 'block',
                }}
              />
              <div style={{ marginTop: 10, fontWeight: 700, fontSize: 14 }}>{c.name}</div>
              <div
                style={{
                  direction: 'ltr',
                  textAlign: 'left',
                  fontSize: 11.5,
                  color: 'var(--accent-soft)',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  marginTop: 3,
                }}
              >
                {c.preset}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, lineHeight: 1.8 }}>
                {c.note}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 11.5,
                    border: '1px solid var(--line)',
                    borderRadius: 999,
                    padding: '3px 9px',
                    color: 'var(--muted)',
                  }}
                >
                  {c.cpu} ثانیهٔ CPU
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    border: '1px solid var(--line)',
                    borderRadius: 999,
                    padding: '3px 9px',
                    color: 'var(--muted)',
                  }}
                >
                  {c.size}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── هزینه ─── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 12px' }}>۳) هزینهٔ واقعی</h2>
        <div className="card" style={{ lineHeight: 2.1, fontSize: 14 }}>
          سرور ۳ هستهٔ پردازشی دارد ⇒ ماهانه <b>۷٬۷۷۶٬۰۰۰ ثانیهٔ CPU</b>.
          <br />
          یک نمای ۸ ثانیه‌ایِ «نزدیک‌شدنِ آرام» = <b>۴۵٫۴ ثانیهٔ CPU</b>.
          <br />
          ⇒ سرور ماهانه <b>~۱۷۱٬۰۰۰ نما</b> می‌سازد.
          <br />
          <span style={{ color: 'var(--green)' }}>
            ⇒ هزینهٔ هر نما = اجارهٔ ماهانهٔ سرور ÷ ۱۷۱٬۰۰۰
          </span>
          <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.9 }}>
            ⚠️ اجارهٔ ماهانهٔ سرور هنوز به من داده نشده (به تصمیمِ بودجه `D-006` وصل است)،
            ولی در هر عددِ محتملی این رقم زیرِ چند ده تومان درمی‌آید.
            <br />
            ⚠️ مقایسهٔ کنارِ‌همِ این خروجی با خروجیِ یک مدلِ ویدیو هنوز انجام نشده —
            به کلیدِ واقعیِ درگاه نیاز دارد.
          </div>
        </div>
      </section>

      {/* ─── ابزار ─── */}
      <section style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 12px' }}>
          ۴) ابزاری که ساخته شد
        </h2>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, lineHeight: 2 }}>
            <b>مسیر:</b>{' '}
            <span style={{ direction: 'ltr', display: 'inline-block', fontFamily: 'monospace' }}>
              packages/motion/
            </span>
            <br />
            <span style={{ direction: 'ltr', display: 'inline-block', fontFamily: 'monospace', fontSize: 12.5 }}>
              src/presets.js
            </span>{' '}
            — سازندهٔ رشتهٔ فیلتر. بدونِ هیچ وابستگی و بدونِ هیچ I/O، تا بدونِ نصبِ
            ffmpeg هم بشود درستی‌اش را آزمود.
            <br />
            <span style={{ direction: 'ltr', display: 'inline-block', fontFamily: 'monospace', fontSize: 12.5 }}>
              src/render.mjs
            </span>{' '}
            — اجرا و گزارشِ هزینه به‌صورتِ یک خطِ JSON.
          </div>
        </div>

        <div style={{ fontSize: 13.5, color: 'var(--muted)', margin: '0 0 8px' }}>اجرا:</div>
        <Mono>
{`node packages/motion/src/render.mjs \\
  --image still.png --out out.mp4 \\
  --preset kenburns_in --aspect R9_16 \\
  --duration 8 --threads 1 [--grain] [--vignette]

⇒ {"preset":"kenburns_in","wallSec":45.41,
   "cpuSecPerOutputSec":5.676,"outputKb":2184,
   "aiCalls":0,"aiCostCoins":0}`}
        </Mono>

        <div style={{ fontSize: 13.5, color: 'var(--muted)', margin: '18px 0 8px' }}>
          رشتهٔ فیلتری که برایِ «نزدیک‌شدنِ آرام» می‌سازد:
        </div>
        <Mono>{FILTER}</Mono>

        <div className="card" style={{ marginTop: 18, borderColor: 'var(--amber-line)', background: 'var(--amber-bg)' }}>
          <b style={{ color: 'var(--amber)' }}>تلهٔ فنی که در راه پیدا شد</b>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 2, color: 'var(--muted)' }}>
            فیلترِ <span style={{ direction: 'ltr', display: 'inline-block', fontFamily: 'monospace' }}>zoompan</span>{' '}
            روی تصویری هم‌اندازهٔ خروجی، پرشِ پیکسلی می‌دهد چون مختصاتِ برش را گِرد می‌کند.
            برایِ همین تصویر اول ۲ برابر بزرگ می‌شود (۲۱۶۰×۳۸۴۰) و بعد برش می‌خورد —
            تا هر فریم فضای کافی برای برشِ زیرپیکسلی داشته باشد.
          </p>
        </div>
      </section>

      <div style={{ fontSize: 12.5, color: 'var(--dim)', borderTop: '1px solid var(--line)', paddingTop: 16 }}>
        شواهدِ کاملِ ترمینال: <span style={{ direction: 'ltr', display: 'inline-block', fontFamily: 'monospace' }}>evidence/probe-route-c.txt</span>
        {' · '}سند: <span style={{ direction: 'ltr', display: 'inline-block', fontFamily: 'monospace' }}>docs/81-…</span>
      </div>
    </main>
  );
}
