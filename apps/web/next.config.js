/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // همان قاعدهٔ وبکستینگ: سندِ HTML هرگز کش نشود تا هر دیپلوی بلافاصله دیده شود.
  // فایل‌های هش‌دارِ /_next/static/* کشِ طولانیِ خود را نگه می‌دارند.
  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico|fonts).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

module.exports = nextConfig;
