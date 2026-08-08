import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'پنل FlowStudio — در دستِ ساخت',
  robots: { index: false, follow: false },
};

// فاز ۰ — پنل هنوز ساخته نشده. این صفحه عمداً وعده نمی‌دهد: می‌گوید چه چیزی
// طراحی شده و چه چیزی هنوز کد ندارد، و کاربر را به فرمِ تماس می‌فرستد.
// وقتی ویزاردِ واقعی آمد، همین مسیر جایش را می‌گیرد.

const READY = [
  'مرحلهٔ ۱ — ایده تا شات‌لیست، زنده و رایگان',
  'لایهٔ درگاهِ AI: رجیستریِ مدل، روترِ هزینه‌آگاه با جایگزینیِ خودکار در خطا',
  'پنلِ مدیریتِ درگاه‌ها و مدل‌ها با کلیدِ رمزنگاری‌شده',
  'دیتابیس با ساختارِ پروژه ← سکانس ← نما (آمادهٔ فرم‌بلند از روزِ اول)',
];

const NOT_READY = [
  'مرحلهٔ ۲ — تولیدِ تصویر (پرداختی) و کیفِ پول',
  'موتورِ ویدیو — هیچ کدِ VIDEO هنوز وجود ندارد',
  'صفِ کارهای طولانی (رندر نمی‌تواند همگام باشد)',
  'ورود با موبایل و پروفایلِ کاربر',
];

export default function AppPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '60px 22px' }}>
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="brand" style={{ marginLeft: 0, marginBottom: 22 }}>
          <div className="brand-mark" />
          <div className="brand-name">FlowStudio</div>
        </div>

        <div className="pill">مرحلهٔ ۱ زنده است</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 14px', letterSpacing: '-.5px' }}>
          اولین مرحله آماده است
        </h1>
        <p style={{ color: 'var(--muted)', lineHeight: 2, maxWidth: '58ch', margin: '0 0 28px' }}>
          ثبت‌نام هنوز باز نشده، ولی می‌توانید همین حالا مرحلهٔ اول را امتحان کنید: ایده‌تان را بنویسید و
          شات‌لیستِ ساختاریافته بگیرید — رایگان. مراحلِ تصویر و ویدیو در راه‌اند.
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
          <a href="/studio" className="btn">
            امتحانِ مرحلهٔ ۱ — ایده تا شات‌لیست
          </a>
          <a href="/#contact" className="btn btn-ghost">
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
