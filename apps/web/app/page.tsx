import ContactForm from './contact-form';

const STEPS = [
  {
    n: '01',
    title: 'ایده و بریف',
    body: 'ایده را به زبان خودت بنویس. مدلِ متن آن را به بریفِ ساختاریافته و شات‌لیست تبدیل می‌کند.',
  },
  {
    n: '02',
    title: 'تولید تصویر',
    body: 'فریمِ کلیدیِ هر نما تولید می‌شود. چند گزینه می‌بینی و آنکه درست است را نگه می‌داری.',
  },
  {
    n: '03',
    title: 'بهینه‌سازی',
    body: 'قواعدِ عددیِ تبلیغات روی نما اعمال می‌شود؛ سید و پارامترها را خودت تنظیم می‌کنی تا خروجی تکرارپذیر بماند.',
  },
  {
    n: '04',
    title: 'تولید ویدیو',
    body: 'تصویر + بریف به موتورِ ویدیو می‌رود. کار در صف اجرا می‌شود و خروجی در کتابخانه می‌نشیند.',
    violet: true,
  },
];

const PRINCIPLES = [
  {
    title: 'بی‌طرف نسبت به مدل',
    body: 'هیچ مدلی پیش‌فرضِ ابدی نیست. هر مدل با هزینه، دسترسی و مجوزِ تجاری‌اش سنجیده می‌شود.',
  },
  {
    title: 'فارسی از پایه',
    body: 'برای کسب‌وکارِ ایرانی نوشته شده — نه ترجمهٔ یک محصولِ خارجی.',
  },
  {
    title: 'هزینهٔ شفاف',
    body: 'پیش از هر کار برآورد می‌بینید؛ کسر فقط پس از تولیدِ واقعی.',
  },
];

const STATS = [
  ['۴', 'مرحله تا تحویل'],
  ['۹+', 'مدلِ متصل'],
  ['ث تا ۶۰د', 'طولِ خروجی'],
  ['۱۴۰۵', 'سالِ شروع'],
];

const NAV = [
  ['#hero', 'خانه'],
  ['#how', 'چطور کار می‌کند'],
  ['#outputs', 'خروجی‌ها'],
  ['#about', 'دربارهٔ ما'],
  ['#contact', 'تماس با ما'],
];

export default function Home() {
  return (
    <>
      <header className="topnav">
        <div className="topnav-inner">
          <div className="brand">
            <div className="brand-mark" />
            <div className="brand-name">FlowStudio</div>
          </div>
          {NAV.map(([href, label]) => (
            <a key={href} href={href} className="navlink">
              {label}
            </a>
          ))}
          <a href="/app" className="btn btn-sm nav-cta">
            ورود / ثبت‌نام
          </a>
        </div>
      </header>

      <section id="hero" className="hero">
        <div className="wrap">
          <div className="pill">از ایده تا دیده</div>
          <h1>از یک ایده تا ویدیوی آمادهٔ انتشار — از چند ثانیه تا فیلمِ کامل</h1>
          <p>
            ایده‌ات را بنویس. سیستم متن را می‌سازد، تصویر تولید می‌کند، با قواعدِ تبلیغاتی بهینه‌اش می‌کند و در
            نهایت به موتورِ ویدیو می‌سپارد — همه در یک پنل، با بهترین ابزارِ هر مرحله. هر طولی که لازم داری:
            تیزرِ چندثانیه‌ای، معرفیِ چند دقیقه‌ای، یا روایتی در حدِ یک فیلمِ کامل.
          </p>
          <div className="hero-actions">
            <a href="/studio" className="btn">
              ایده‌ات را بنویس — رایگان
            </a>
            <a href="#outputs" className="btn btn-ghost">
              تماشای نمونه‌ها
            </a>
          </div>
          <div className="hero-notes">
            <div>✓ بدون نیاز به تیم تدوین</div>
            <div>✓ پرداخت به‌ازای مصرف</div>
            <div>✓ خروجیِ عمودی و افقی</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2 id="how" className="h2">
            چهار مرحله، یک چرخه
          </h2>
          <p className="lead">
            هر مرحله ابزارِ خودش را دارد و شما انتخاب می‌کنید — یا می‌گذارید سیستم بهترین را انتخاب کند.
          </p>
          <div className="grid-auto">
            {STEPS.map((s) => (
              <div key={s.n} className="card" style={s.violet ? { borderColor: 'var(--violet-line)' } : undefined}>
                <div className={s.violet ? 'step-num violet' : 'step-num'}>{s.n}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-body">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid-half" style={{ alignItems: 'center' }}>
          <div>
            <h2 id="outputs" className="h2">
              یک چرخه، هر طولی که نیاز داری
            </h2>
            <p className="lead" style={{ maxWidth: '52ch', lineHeight: 2 }}>
              همان پروژه، هر تحویلی که لازم داری: نسخهٔ کوتاهِ عمودی برای شبکه‌های اجتماعی، نسخهٔ بلندِ افقی برای
              نمایشِ خانگی و صفحهٔ محصول، یا روایتی به‌درازای یک فیلمِ کامل.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div className="chip">
                <b>تبلیغاتی · ۹:۱۶ · ۳۰ ثانیه</b> — اینستاگرام، تیک‌تاک، استوری
              </div>
              <div className="chip">
                <b>بلند · ۱۶:۹ · چند دقیقه</b> — پلتفرم خانگی، صفحهٔ محصول، ویترین
              </div>
              <div className="chip">
                <b>روایتِ کامل · تا ۶۰ دقیقه</b> — مستند و فیلمِ کوتاه با هوش مصنوعی
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 12 }}>
            <div className="placeholder" style={{ aspectRatio: '9/16' }}>
              <span>social 9:16</span>
            </div>
            <div className="placeholder" style={{ aspectRatio: '16/9', alignSelf: 'center' }}>
              <span>long-form 16:9</span>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="section" style={{ scrollMarginTop: 110 }}>
        <div className="wrap">
          <div className="grid-half" style={{ gap: 34 }}>
            <div>
              <div className="eyebrow">دربارهٔ ما</div>
              <h2 className="h2" style={{ maxWidth: '18ch', marginBottom: 14 }}>
                ما ابزار نمی‌سازیم؛ آن‌ها را هماهنگ می‌کنیم
              </h2>
              <p style={{ margin: '0 0 14px', color: 'var(--muted)', lineHeight: 2, maxWidth: '56ch' }}>
                هر ماه یک مدلِ تصویر یا ویدیوی بهتر می‌آید. مشکلِ تولیدکنندهٔ محتوا کمبودِ مدل نیست — نبودِ مسیری
                است که ایده را با ترتیبِ درست از میانِ این مدل‌ها عبور دهد و در انتها چیزی تحویل بدهد که قابلِ
                انتشار باشد.
              </p>
              <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 2, maxWidth: '56ch' }}>
                FlowStudio همان مسیر است: بریف، تصویر، بهینه‌سازی با قواعدِ عددیِ تبلیغات، و تولیدِ ویدیو — با
                دفترِ ثبتی که هر تصمیم، سید و نسخهٔ مدل را نگه می‌دارد تا خروجیِ فردا از خروجیِ امروز بهتر باشد.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="card" style={{ borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--white)', fontSize: 14.5, marginBottom: 4 }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: 13.2, color: 'var(--muted)', lineHeight: 1.95 }}>{p.body}</div>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
              gap: 12,
              marginTop: 30,
            }}
          >
            {STATS.map(([n, l]) => (
              <div key={l} className="stat">
                <div className="stat-n">{n}</div>
                <div className="stat-l">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="section" style={{ scrollMarginTop: 110 }}>
        <div className="wrap grid-half" style={{ gap: 24 }}>
          <div>
            <div className="eyebrow">تماس با ما</div>
            <h2 className="h2">سؤالی دارید؟ بپرسید</h2>
            <p style={{ margin: '0 0 22px', color: 'var(--muted)', lineHeight: 2, maxWidth: '48ch' }}>
              برای دموی اختصاصی، همکاری، یا اتصالِ پنلِ سایتِ خودتان به FlowStudio پیام بگذارید. معمولاً همان
              روزِ کاری پاسخ می‌دهیم.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="contact-row">
                <span className="icon">✉</span>
                <div>
                  <div className="k">ایمیل</div>
                  <div className="v ltr">hello@flowstudio.ir</div>
                </div>
              </div>
              <div className="contact-row">
                <span className="icon">⌖</span>
                <div>
                  <div className="k">نشانی</div>
                  <div className="v">تهران — پشتیبانی آنلاین، شنبه تا چهارشنبه ۹ تا ۱۸</div>
                </div>
              </div>
            </div>
          </div>
          <ContactForm />
        </div>
      </section>

      <section className="section" style={{ borderBottom: 0 }}>
        <div className="wrap cta">
          <h2>از همین حالا شروع کن</h2>
          <p>مرحلهٔ اول رایگان است. هزینه فقط وقتی کسر می‌شود که کارِ تولید واقعاً اجرا شود.</p>
          <a href="/studio" className="btn" style={{ padding: '13px 34px' }}>
            ساختِ شات‌لیست
          </a>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-grid">
          <div>
            <div className="brand" style={{ marginBottom: 12, marginLeft: 0 }}>
              <div className="brand-mark" />
              <div className="brand-name">FlowStudio</div>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13.2, color: 'var(--dim)', lineHeight: 2, maxWidth: '34ch' }}>
              ارکستراتورِ تولید ویدیو با هوش مصنوعی — از ایده تا خروجیِ آمادهٔ انتشار، در یک پنل.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="#contact" className="social">in</a>
              <a href="#contact" className="social">ig</a>
              <a href="#contact" className="social">tg</a>
            </div>
          </div>
          <div>
            <h4>محصول</h4>
            <div className="footer-col">
              <a href="#how">چطور کار می‌کند</a>
              <a href="#outputs">خروجی‌ها</a>
              <a href="#contact">تعرفه‌ها</a>
              <a href="#contact">مدل‌های پشتیبانی‌شده</a>
            </div>
          </div>
          <div>
            <h4>شرکت</h4>
            <div className="footer-col">
              <a href="#about">دربارهٔ ما</a>
              <a href="#contact">تماس با ما</a>
              <a href="#contact">همکاری با ما</a>
            </div>
          </div>
          <div>
            <h4>پشتیبانی</h4>
            <div className="footer-col">
              <a href="#contact">راهنمای شروع</a>
              <a href="#contact">مستندات API</a>
              <a href="#contact">قوانین محتوا</a>
              <a href="#contact">حریم خصوصی</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div>© ۱۴۰۵ FlowStudio — تمامی حقوق محفوظ است.</div>
          <div>خروجی‌ها با برچسبِ محتوای تولیدشده با هوش مصنوعی منتشر می‌شوند</div>
        </div>
      </footer>
    </>
  );
}
