import { NextResponse } from 'next/server';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// فاز ۰ — هنوز نه دیتابیسی هست نه سرویسِ ایمیلی. سرنخ‌ها به یک فایلِ JSONL روی
// والیومِ داکر می‌روند تا هیچ پیامی گم نشود. وقتی API واقعی آمد، همین فایل
// import می‌شود. مسیر با FLOWSTUDIO_LEADS_FILE قابلِ تغییر است.
const LEADS_FILE = process.env.FLOWSTUDIO_LEADS_FILE || '/data/leads.jsonl';

const FIELDS = ['name', 'business', 'contact', 'subject', 'message'] as const;
const MAX = { name: 120, business: 120, contact: 160, subject: 80, message: 4000 };

function clean(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  // حذفِ کاراکترهای کنترلی تا خطِ JSONL نشکند
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'بدنهٔ درخواست معتبر نیست' }, { status: 400 });
  }

  const lead: Record<string, string> = {};
  for (const f of FIELDS) lead[f] = clean(body[f], MAX[f]);

  if (!lead.name || !lead.contact || !lead.message) {
    return NextResponse.json({ error: 'نام، راه ارتباطی و پیام الزامی است' }, { status: 400 });
  }

  const record = {
    at: new Date().toISOString(),
    ...lead,
    ip: req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || '',
    ua: (req.headers.get('user-agent') || '').slice(0, 300),
  };

  try {
    await mkdir(dirname(LEADS_FILE), { recursive: true });
    await appendFile(LEADS_FILE, JSON.stringify(record) + '\n', 'utf8');
  } catch (e) {
    // اگر نوشتن شکست خورد، دستِ‌کم در لاگِ کانتینر بماند — پیام نباید گم شود.
    console.error('[contact] نوشتن در فایل شکست خورد:', (e as Error).message, JSON.stringify(record));
    return NextResponse.json({ error: 'ثبت پیام ممکن نشد؛ لطفاً ایمیل بزنید' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
