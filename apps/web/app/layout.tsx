import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FlowStudio — ارکستراتور تولید ویدیو با هوش مصنوعی',
  description:
    'ایده‌ات را بنویس. سیستم متن را می‌سازد، تصویر تولید می‌کند، با قواعدِ تبلیغاتی بهینه‌اش می‌کند و در نهایت به موتورِ ویدیو می‌سپارد — همه در یک پنل.',
  // فعلاً روی زیردامنهٔ وبکستینگ زندگی می‌کند؛ دامنهٔ اختصاصی بعداً وصل می‌شود.
  metadataBase: new URL('https://flowstudio.webcasting.ir'),
  // تا پیش از راه‌اندازیِ کامل، هیچ موتورِ جست‌وجویی این را ایندکس نکند.
  robots: { index: false, follow: false },
  openGraph: {
    title: 'FlowStudio — ارکستراتور تولید ویدیو',
    description: 'از یک ایده تا ویدیوی آمادهٔ انتشار، در یک چرخهٔ کامل.',
    locale: 'fa_IR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f1115',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
