/**
 * برنامه‌ریزِ محلی — شات‌لیست **بدونِ هیچ فراخوانِ بیرونی**.
 *
 * چرا وجود دارد: تا روزی که کلیدِ یک تجمیع‌کننده ثبت شود، `/studio` هیچ
 * مدلی برایِ صدا زدن ندارد و کلِ زنجیره — صف، کارگر، تولید، فایل — روی
 * زمین می‌ماند و اثباتش ممکن نیست. این فایل همان جایِ خالی را با یک قاعدهٔ
 * **قطعی و قابلِ‌بازتولید** پر می‌کند: متن را به واحدهای معنایی می‌شکند و هر
 * واحد را یک نما می‌گیرد.
 *
 * 🔒 دو چیزی که این‌جا عمداً انجام **نمی‌شود**:
 *
 *   • هیچ ادعایِ خلاقیتی. نور و حالِ رنگ اصلاً پر نمی‌شوند، چون یک شکنندهٔ
 *     متن هیچ مبنایی برایِ گفتنشان ندارد. پر کردنشان با مقدارِ ساختگی یعنی
 *     دروغ‌گفتن به کاربر و آلودنِ همان داده‌ای که فردا معیارِ سنجشِ مدل است.
 *   • هیچ پنهان‌کاری. خروجی با `planner: 'local'` برچسب می‌خورد و رابط آن را
 *     صریح نشان می‌دهد — کاربر باید بداند این شات‌لیست را ماشینِ زبانی
 *     ننوشته.
 *
 * روزی که مدلِ واقعی ثبت شود این مسیر خودبه‌خود کنار می‌رود: تصمیم در
 * `ProjectsService` است و شرطش «آیا مدلِ TEXTی هست» — نه یک پرچمِ دستی.
 */

export interface LocalPlanShot {
  durationSec: number;
  description: string;
  cameraMovement: string;
  miseEnScene?: string;
  shotSize?: string;
  cameraAngle?: string;
}

export interface LocalPlanSequence {
  title: string;
  shots: LocalPlanShot[];
}

export interface LocalPlan {
  title: string;
  sequences: LocalPlanSequence[];
}

export interface LocalPlanInput {
  rawIdea: string;
  targetDurationSec: number;
  typeTitle: string;
  /** پاسخ‌های کاربر به زیرشاخه‌های همان نوع — عنوان از این‌جا بهتر درمی‌آید. */
  attributes?: Record<string, unknown>;
}

/**
 * مدتِ هر نما.
 *
 * سقف عمداً همان ۱۵ ثانیهٔ `clampDuration`ِ سرویس است؛ اگر این‌جا بزرگ‌تر
 * می‌بود، سرویس بی‌صدا کوتاهش می‌کرد و جمعِ مدت با آنچه کاربر خواسته فرق
 * می‌کرد بدونِ اینکه کسی بفهمد چرا.
 */
const MIN_SHOT_SEC = 3;
const MAX_SHOT_SEC = 15;
/** مدتِ هدفِ هر نما — مبنایِ «چند نما لازم است». */
const IDEAL_SHOT_SEC = 6;

/**
 * چرخهٔ حرکتِ دوربین.
 *
 * ترتیب تصادفی نیست: نمای اول ثابت است تا بیننده جا بیفتد، بعد حرکت‌ها
 * می‌آیند، و هر چند نما یک ثابت برایِ نفس‌کشیدن. چرخه‌بودنش یعنی خروجی
 * برایِ یک ورودیِ ثابت همیشه یکی است — قابلِ بازتولید، مثلِ هر گامِ دیگر.
 */
const MOVEMENT_CYCLE = ['STATIC', 'DOLLY', 'PAN', 'STATIC', 'TILT', 'DOLLY'];
const SHOT_SIZE_CYCLE = ['WIDE', 'MEDIUM', 'CLOSE_UP', 'MEDIUM', 'WIDE', 'CLOSE_UP'];
const ANGLE_CYCLE = ['EYE_LEVEL', 'EYE_LEVEL', 'LOW', 'EYE_LEVEL', 'HIGH', 'EYE_LEVEL'];

/** بیشترین نمایی که در یک سکانس می‌نشیند، پیش از آن‌که فهرست ناخوانا شود. */
const SHOTS_PER_SEQUENCE = 4;

export function buildLocalPlan(input: LocalPlanInput): LocalPlan {
  const sentences = splitIntoUnits(input.rawIdea);
  if (sentences.length === 0) {
    throw new Error('متنِ ایده هیچ جملهٔ قابلِ استفاده‌ای نداشت.');
  }

  // چند نما «می‌خواهیم» از مدت می‌آید؛ چند نما «می‌توانیم» از متن.
  const wanted = Math.max(1, Math.min(40, Math.round(input.targetDurationSec / IDEAL_SHOT_SEC)));
  const units = ensureUnits(sentences, wanted);
  const shotCount = Math.min(wanted, units.length);

  const merged = distributeUnits(units, shotCount);
  const durations = distributeDuration(input.targetDurationSec, merged.length);

  const shots: LocalPlanShot[] = merged.map((text, i) => ({
    durationSec: durations[i],
    description: text,
    cameraMovement: MOVEMENT_CYCLE[i % MOVEMENT_CYCLE.length],
    shotSize: SHOT_SIZE_CYCLE[i % SHOT_SIZE_CYCLE.length],
    cameraAngle: ANGLE_CYCLE[i % ANGLE_CYCLE.length],
    // نور و رنگ عمداً خالی‌اند — بندِ «هیچ ادعایِ خلاقیتی» بالا.
  }));

  const sequences: LocalPlanSequence[] = [];
  for (let i = 0; i < shots.length; i += SHOTS_PER_SEQUENCE) {
    const chunk = shots.slice(i, i + SHOTS_PER_SEQUENCE);
    const index = Math.floor(i / SHOTS_PER_SEQUENCE) + 1;
    sequences.push({
      // رقمِ فارسی، چون این متن مستقیم به کاربر نشان داده می‌شود.
      title: shots.length <= SHOTS_PER_SEQUENCE ? input.typeTitle : `بخش ${faDigits(index)}`,
      shots: chunk,
    });
  }

  return {
    title: buildTitle(input.rawIdea, input.attributes ?? {}, input.typeTitle),
    sequences,
  };
}

/**
 * شکستنِ متن به واحدهای معنایی.
 *
 * اول خط‌ها، بعد نقطه و علامتِ سؤال و تعجب و نقطه‌ویرگول. ویرگول عمداً
 * جداکننده **نیست**: در فارسی ویرگول بیشتر داخلِ یک جمله می‌آید تا بینِ دو
 * جمله، و شکستن روی آن نماهایِ نیمه‌کاره می‌سازد. واحدِ خیلی بلند در گامِ
 * بعد روی ویرگول شکسته می‌شود، ولی فقط اگر واقعاً لازم شود.
 */
function splitIntoUnits(raw: string): string[] {
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    for (const piece of line.split(/(?<=[.؟!؛])\s+/)) {
      const clean = normalize(piece);
      if (clean.length >= 2) out.push(clean);
    }
  }
  return out;
}

function normalize(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^[-*•\d.)\s]+/, '')
    .trim();
}

/**
 * اگر جمله‌ها کم‌تر از نمای لازم‌اند، بلندترین‌ها شکسته می‌شوند.
 *
 * اول رویِ ویرگول — که مرزِ طبیعیِ درونِ جمله است — و اگر باز کم بود، روی
 * مرزِ کلمه. هرگز یک واحد **تکرار** نمی‌شود: دو نما با متنِ یکسان یعنی
 * شات‌لیستی که به کاربر دروغ می‌گوید کارِ بیشتری شده.
 *
 * وقتی متن واقعاً کوتاه‌تر از آن است که این‌قدر نما بدهد، همان تعدادِ کم
 * برمی‌گردد و ویدیو کوتاه‌تر از مدتِ هدف درمی‌آید — که صادقانه است و در
 * رابط هم جمعِ واقعیِ مدت نشان داده می‌شود.
 */
function ensureUnits(units: string[], needed: number): string[] {
  let out = [...units];

  for (const separator of [/(?<=،)\s+/, / /]) {
    if (out.length >= needed) break;
    const next: string[] = [];
    for (const unit of out) {
      if (out.length + next.length - 1 >= needed || unit.split(' ').length < 6) {
        next.push(unit);
        continue;
      }
      const pieces = splitBalanced(unit, separator);
      next.push(...pieces);
    }
    out = next;
  }

  return out;
}

/** یک واحد را به دو نیمهٔ نزدیک‌به‌هم می‌شکند، نه به تکه‌های ریز. */
function splitBalanced(unit: string, separator: RegExp): string[] {
  const parts = unit.split(separator).filter((p) => p.trim().length > 0);
  if (parts.length < 2) return [unit];

  const mid = Math.ceil(parts.length / 2);
  const left = parts.slice(0, mid).join(' ').trim();
  const right = parts.slice(mid).join(' ').trim();
  if (!left || !right) return [unit];
  return [left, right];
}

/** واحدهای اضافه در نماها پخش می‌شوند، نه دور ریخته. */
function distributeUnits(units: string[], shotCount: number): string[] {
  if (shotCount <= 1) return [units.join(' ')];
  if (units.length <= shotCount) return units;

  // تقسیمِ سرشکن: باقی‌ماندهٔ واحدها یکی‌یکی به نماهایِ اول می‌رسد، تا هیچ
  // نمایی خالی نماند و هیچ واحدی هم دور ریخته نشود.
  const base = Math.floor(units.length / shotCount);
  let extra = units.length - base * shotCount;

  const out: string[] = [];
  let cursor = 0;
  for (let i = 0; i < shotCount; i++) {
    const take = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    out.push(units.slice(cursor, cursor + take).join(' ').trim());
    cursor += take;
  }
  return out.filter((s) => s.length > 0);
}

/**
 * پخشِ مدت رویِ نماها.
 *
 * باقی‌مانده یکی‌یکی به نماهایِ اول اضافه می‌شود تا **جمع دقیقاً برابرِ مدتِ
 * هدف** بماند. گِردکردنِ ساده روی ده نما تا چند ثانیه اختلاف می‌سازد و
 * کاربر «۳۰ ثانیه» خواسته ولی ۲۷ ثانیه می‌گیرد.
 */
function distributeDuration(targetSec: number, shotCount: number): number[] {
  const base = Math.floor(targetSec / shotCount);
  let remainder = targetSec - base * shotCount;

  const out: number[] = [];
  for (let i = 0; i < shotCount; i++) {
    let d = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    out.push(Math.max(MIN_SHOT_SEC, Math.min(MAX_SHOT_SEC, d)));
  }
  return out;
}

/** رقم لاتین در متن فارسی جهت خواندن را می‌شکند. */
function faDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/**
 * فیلدهایی که ذاتاً «نامِ کار»اند.
 *
 * ترتیب مهم است: نامِ برند از موضوعِ مستند دقیق‌تر است و هر دو از جملهٔ اولِ
 * متن بهتر — چون جملهٔ اول یک **جمله** است، نه یک نام، و روی تصویر مثلِ
 * تکرارِ متنِ همان نما دیده می‌شود.
 */
const TITLE_KEYS = ['brand', 'subject', 'title', 'name'];

/** عنوان: اول چیزی که کاربر خودش نوشته، بعد جملهٔ اول. */
function buildTitle(
  raw: string,
  attributes: Record<string, unknown>,
  fallback: string,
): string {
  for (const key of TITLE_KEYS) {
    const value = String(attributes?.[key] ?? '').trim();
    if (value) return shorten(value, 48);
  }
  const first = splitIntoUnits(raw)[0];
  if (!first) return fallback;
  return shorten(first.replace(/[.؟!؛:]+$/, '').trim(), 48);
}

/** بریدن روی مرزِ کلمه — نصفه‌شدنِ یک کلمه بدترین جایِ بریدن است. */
function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max / 3 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
