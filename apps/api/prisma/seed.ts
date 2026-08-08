// بذرِ اولیهٔ ReasonCode — پنج کدِ جای‌گیر (منشورِ اجرا، بخشِ ۶).
// تاکسونومی از استفادهٔ واقعی رشد می‌کند؛ این فقط نقطهٔ شروع است.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REASON_CODES = [
  { code: 'PACE_CINEMATIC', label: 'روایتِ آرام/سینمایی — قاعدهٔ ریتم صدق نمی‌کند', category: 'RULE_EXCEPTION' },
  { code: 'NO_OFFER_PRESENT', label: 'محتوایِ برندینگِ محض — پیشنهادِ فروش ندارد', category: 'RULE_EXCEPTION' },
  { code: 'QUALITY_ISSUE', label: 'کیفیتِ خروجی پایین‌تر از حدِ قابلِ‌قبول', category: 'REJECTION' },
  { code: 'BRAND_MISMATCH', label: 'با هویتِ بصریِ برند همخوانی ندارد', category: 'REJECTION' },
  { code: 'OTHER', label: 'دلیلِ دیگر', category: 'GENERIC' },
];

async function main() {
  for (const rc of REASON_CODES) {
    await prisma.reasonCode.upsert({
      where: { code: rc.code },
      update: {},
      create: rc,
    });
  }
  console.log(`seeded ${REASON_CODES.length} reason codes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
