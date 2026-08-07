import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'پنل FlowStudio — در دستِ ساخت',
  robots: { index: false, follow: false },
};

// فاز ۰ — پنل هنوز ساخته نشده. این صفحه عمداً وعده نمی‌دهد: می‌گوید چه چیزی
// طراحی شده و چه چیزی هنوز کد ندارد، و کاربر را به فرمِ تماس می‌فرستد.
// وقتی ویزاردِ واقعی آمد، همین مسیر جایش را می‌گیرد.

const READY = [
  'طرحِ کاملِ رابط برای هر چهار مرحله و پنلِ مدیریت',
  'روترِ چنددرگاهی با جایگزینیِ خودکار در خطا (از ماژولِ وبکستینگ)',
  'چرخهٔ مالیِ hold / settle / release',
];

const NOT_READY = [
  'موتورِ ویدیو — هیچ کدِ VIDEO هنوز وجود ندارد',
  'صفِ کارهای طولانی (رندر نمی‌تواند همگام باشد)',
  'دفترِ ثبتِ تولید با سید، نسخهٔ مدل و حکمِ انسانی',
  'موتورِ قواعد با کلاسِ شواهد E / C / A',
];

export default function AppPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '60px 22px' }}>
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="brand" style={{ marginLeft: 0, marginBottom: 22 }}>
          <div className="brand-mark" />
          <div className="brand-name">FlowStudio</div>
        </div>

        <div className="pill">پنل در دستِ ساخت</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 14px', letterSpacing: '-.5px' }}>
          هنوز نمی‌توانید ثبت‌نام کنید
        </h1>
        <p style={{ color: 'var(--muted)', lineHeight: 2, maxWidth: '58ch', margin: '0 0 28px' }}>
          طراحیِ پنل کامل است، ولی موتورِ پشتِ آن هنوز ساخته می‌شود. تا آن روز، اگر می‌خواهید اولین کاربر باشید
          یا پنلِ سایتِ خودتان را وصل کنید، از فرمِ تماس پیام بگذارید.
        </p>

        <div className="grid-half">
          <div className="card">
            <div style={{ fontWeight: 800, color: 'var(--green)', marginBottom: 10 }}>آماده است</div>
            <ul style={{ paddingInlineStart: 18, color: 'var(--muted)', fontSize: 13.4, lineHeight: 2 }}>
              {READY.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="card">
            <div style={{ fontWeight: 800, color: 'var(--amber)', marginBottom: 10 }}>هنوز نه</div>
            <ul style={{ paddingInlineStart: 18, color: 'var(--muted)', fontSize: 13.4, lineHeight: 2 }}>
              {NOT_READY.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 26 }}>
          <a href="/#contact" className="btn">
            پیام بگذارید
          </a>
          <a href="/" className="btn btn-ghost">
            بازگشت به صفحهٔ اصلی
          </a>
        </div>
      </div>
    </main>
  );
}
