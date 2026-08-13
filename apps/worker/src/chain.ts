import { createHash } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import type { PlanStep, PrismaClient } from '@prisma/client';
import { Ledger, stepCost } from '@flowstudio/ledger';
import { config } from './config';
import { engines } from './engines';
import { backgroundHtml, textHtml, ASPECTS, type LayerInput } from './render/html';
import { htmlToPng } from './render/chromium';
import { probeDurationSec, renderShotClip } from './render/ffmpeg';
import { load, store } from './storage';

/**
 * اجرایِ زنجیرهٔ یک نما.
 *
 * هر کار (`Job`) یک نماست و یک زنجیره از گام‌ها دارد؛ **خروجیِ هر گام
 * ورودیِ گامِ بعدی است**. زنجیره به‌ترتیبِ `orderIndex` جلو می‌رود و
 * `dependsOn` تضمین می‌کند گامی پیش از پیش‌نیازش شروع نشود.
 *
 * سه قاعده‌ای که این فایل رعایتشان می‌کند:
 *
 *   ۱. **رزرو پیش از خرج، آزادسازی در شکست** — هر گام از `runWithHold` رد
 *      می‌شود، حتی گامی که هزینه‌اش صفر است. آن روز که یک گامِ پولی به
 *      زنجیره اضافه شود، هیچ‌کس یادش نمی‌رود رزرو بگذارد.
 *   ۲. **هر گام یک ردیفِ تولید می‌نویسد** — بدونِ آن معیارِ انتخابِ مدل
 *      محاسبه‌ناپذیر است (قلمِ ۸).
 *   ۳. **گامِ تمام‌شده دوباره اجرا نمی‌شود** — کارِ نیمه‌کاره از همان‌جا که
 *      مانده ادامه پیدا می‌کند، نه از اول.
 */

// هزینهٔ هر قابلیت به `@flowstudio/ledger` رفت — رابط هم پیش از ساخت به
// همین عددها نیاز دارد و دو جدول فردا واگرا می‌شوند.

const WATERMARK = process.env.WATERMARK_TEXT ?? 'ساختهٔ فلواستودیو';

type JobWithContext = {
  id: string;
  groupId: string;
  shotId: string;
  group: { id: string; userId: string; projectId: string | null; budgetCap: number };
  shot: {
    id: string;
    order: number;
    description: string;
    durationSec: number;
    aspectRatio: string;
    sequence: { project: { id: string; title: string; userId: string } };
  };
};

interface StepOutput {
  /** کلیدِ ذخیره‌سازی. */
  key: string;
  /** مسیرِ محلی داخلِ پوشهٔ کارِ همین اجرا. */
  path: string;
  hash: string;
  byteSize: number;
  durationSec: number | null;
}

export async function runJobChain(
  prisma: PrismaClient,
  ledger: Ledger,
  job: JobWithContext,
): Promise<{ clipAssetId: string; steps: number }> {
  const workDir = join(config.tmpDir, job.id);
  await mkdir(workDir, { recursive: true });

  try {
    const steps = await prisma.planStep.findMany({
      where: { jobGroupId: job.groupId, shotId: job.shotId },
      orderBy: { orderIndex: 'asc' },
    });
    if (steps.length === 0) {
      throw new Error('این نما هیچ گامِ پلانی ندارد — برنامه‌ریز کارش را ناقص گذاشته.');
    }

    await prisma.shot.update({ where: { id: job.shotId }, data: { status: 'GENERATING' } });

    const outputs = new Map<string, StepOutput>();
    for (const step of steps) {
      assertDependenciesReady(step, outputs);
      const done = await reuseIfDone(prisma, step, workDir, outputs);
      if (done) continue;

      const cost = stepCost(step.capability);
      await ledger.runWithHold(
        {
          userId: job.group.userId,
          jobGroupId: job.groupId,
          estimatedCost: cost,
          purpose: `گامِ ${step.capability} — نمای ${job.shot.order}`,
        },
        async () => {
          const output = await executeStep(prisma, job, step, workDir, outputs);
          outputs.set(step.id, output);
          return { result: output, actualCost: cost };
        },
      );
    }

    const last = steps[steps.length - 1];
    const clip = outputs.get(last.id);
    if (!clip) throw new Error('زنجیره تمام شد ولی هیچ خروجیِ نهایی‌ای نداشت.');

    const asset = await upsertClipAsset(prisma, job, clip);
    await prisma.shot.update({ where: { id: job.shotId }, data: { status: 'DONE' } });

    return { clipAssetId: asset.id, steps: steps.length };
  } finally {
    // پوشهٔ کار همیشه پاک می‌شود — حتی وقتی کار شکست خورده. چند مگابایت
    // PNG به‌ازای هر تلاشِ ناموفق، دیسکِ سرور را بی‌سروصدا پر می‌کند.
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * گرافِ جهت‌دار — گام پیش از پیش‌نیازش اجرا نمی‌شود.
 *
 * امروز `orderIndex` هم همین را تضمین می‌کند، ولی ترتیب یک **قرارداد
 * ضعیف** است: روزی که گام‌ها موازی شوند یا برنامه‌ریز ترتیب را عوض کند،
 * تنها چیزی که جلویِ اجرایِ زودهنگام را می‌گیرد همین بررسی است.
 */
function assertDependenciesReady(step: PlanStep, outputs: Map<string, StepOutput>): void {
  const deps = Array.isArray(step.dependsOn) ? (step.dependsOn as string[]) : [];
  const missing = deps.filter((id) => !outputs.has(id));
  if (missing.length > 0) {
    throw new Error(`گامِ ${step.capability} پیش‌نیازِ آماده‌نشده دارد: ${missing.join('، ')}`);
  }
}

/** خروجیِ گامِ ازپیش‌تمام‌شده از انبار برمی‌گردد، نه از رندرِ دوباره. */
async function reuseIfDone(
  prisma: PrismaClient,
  step: PlanStep,
  workDir: string,
  outputs: Map<string, StepOutput>,
): Promise<boolean> {
  const previous = await prisma.generation.findFirst({
    where: { planStepId: step.id, resultUrl: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  if (!previous?.resultUrl) return false;

  try {
    const buffer = await load(previous.resultUrl);
    const ext = previous.resultUrl.split('.').pop() ?? 'bin';
    const path = join(workDir, `${step.id}.${ext}`);
    await writeFile(path, buffer);
    outputs.set(step.id, {
      key: previous.resultUrl,
      path,
      hash: previous.resultHash ?? '',
      byteSize: buffer.length,
      durationSec: previous.outputDurationSec,
    });
    return true;
  } catch {
    // ردیف هست ولی فایلش نیست (والیوم پاک شده؟) — دوباره ساخته می‌شود.
    return false;
  }
}

async function executeStep(
  prisma: PrismaClient,
  job: JobWithContext,
  step: PlanStep,
  workDir: string,
  outputs: Map<string, StepOutput>,
): Promise<StepOutput> {
  const params = (step.params ?? {}) as Record<string, unknown>;
  const startedAt = Date.now();
  const engine = await engines();

  let output: StepOutput;
  let engineName: string;
  let engineVersion: string;

  if (step.capability === 'html2image') {
    const layer = String(params.layer ?? 'background');
    const aspect = job.shot.aspectRatio in ASPECTS ? job.shot.aspectRatio : 'R9_16';
    const { w, h } = ASPECTS[aspect];
    const position = await globalPosition(prisma, job);
    const layerInput: Omit<LayerInput, 'watermark'> = {
      aspect,
      shotId: job.shot.id,
      ...position,
      description: job.shot.description,
      projectTitle: job.shot.sequence.project.title,
    };

    const png = await htmlToPng({
      html:
        layer === 'text'
          ? textHtml({ ...layerInput, watermark: WATERMARK })
          : backgroundHtml({ ...layerInput, watermark: null }),
      width: w,
      height: h,
      transparent: layer === 'text',
      workDir,
      name: `${step.id}-${layer}`,
    });

    const saved = await store(job.group.userId, png, 'png');
    output = { ...saved, path: join(workDir, `${step.id}.png`), durationSec: null };
    await writeFile(output.path, png);
    engineName = `html2image@chromium/${layer}`;
    engineVersion = engine.chromium;
  } else if (step.capability === 'programmatic_motion') {
    const deps = Array.isArray(step.dependsOn) ? (step.dependsOn as string[]) : [];
    const [backgroundId, textId] = deps;
    const background = outputs.get(backgroundId);
    if (!background) throw new Error('لایهٔ زمینه آماده نیست.');
    const text = textId ? outputs.get(textId) : undefined;

    const outputPath = join(workDir, `${step.id}.mp4`);
    await renderShotClip({
      backgroundPath: background.path,
      textPath: text?.path ?? null,
      outputPath,
      preset: String(params.preset ?? 'still'),
      aspect: job.shot.aspectRatio in ASPECTS ? job.shot.aspectRatio : 'R9_16',
      durationSec: job.shot.durationSec,
    });

    const buffer = await readFile(outputPath);
    const saved = await store(job.group.userId, buffer, 'mp4');
    output = { ...saved, path: outputPath, durationSec: await probeDurationSec(outputPath) };
    engineName = `programmatic_motion@ffmpeg/${String(params.preset ?? 'still')}`;
    engineVersion = engine.ffmpeg;
  } else {
    // تاکسونومیِ گام بسته است. قابلیتِ ناشناخته یعنی برنامه‌ریز چیزی خواسته
    // که کارگر بلد نیست — و بی‌صدا ردکردنش کاری را «تمام» نشان می‌دهد که
    // هرگز انجام نشده.
    throw new Error(`قابلیتِ «${step.capability}» را این کارگر بلد نیست.`);
  }

  await prisma.generation.create({
    data: {
      jobId: job.id,
      shotId: job.shotId,
      planStepId: step.id,
      modelVersion: engineVersion,
      modelKeySnap: engineName,
      paramHash: hashParams(step, job),
      resultUrl: output.key,
      resultHash: output.hash,
      costActual: stepCost(step.capability),
      latencyMs: Date.now() - startedAt,
      outputDurationSec: output.durationSec,
      c2paWatermarkText: step.capability === 'programmatic_motion' ? WATERMARK : null,
      attemptIndex: (await prisma.generation.count({ where: { planStepId: step.id } })) + 1,
    },
  });

  return output;
}

/**
 * جایگاهِ نما در کلِ فیلم — نه در سکانسش.
 *
 * ⚠️ `Shot.order` هر سکانس از یک شروع می‌شود. اگر همان روی تصویر بنشیند،
 * تماشاگر دو بار «نمای ۱» می‌بیند و شمارش بی‌معنا می‌شود. ترتیبِ درست
 * همان ترتیبِ روایت است: اول سکانس، بعد نما — دقیقاً همان چیزی که مونتاژ
 * هم با آن می‌چسباند.
 */
async function globalPosition(
  prisma: PrismaClient,
  job: JobWithContext,
): Promise<{ shotOrder: number; shotCount: number }> {
  const all = await prisma.shot.findMany({
    where: { sequence: { projectId: job.shot.sequence.project.id } },
    orderBy: [{ sequence: { order: 'asc' } }, { order: 'asc' }],
    select: { id: true },
  });
  const index = all.findIndex((s) => s.id === job.shotId);
  return { shotOrder: index === -1 ? job.shot.order : index + 1, shotCount: all.length };
}

/**
 * اثرِ انگشتِ ورودی‌های یک گام.
 *
 * مبنایِ «آیا همان ورودی همان خروجی را داد» است. توضیحِ نما داخلش هست چون
 * تصویر از همان ساخته می‌شود؛ شناسهٔ نما هم هست چون رنگِ زمینه از آن می‌آید.
 */
function hashParams(step: PlanStep, job: JobWithContext): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        capability: step.capability,
        params: step.params ?? null,
        shotId: job.shot.id,
        description: job.shot.description,
        durationSec: job.shot.durationSec,
        aspect: job.shot.aspectRatio,
      }),
    )
    .digest('hex');
}

/**
 * کلیپِ نما به‌عنوانِ دارایی.
 *
 * قاعدهٔ ۸ منشور: **خروجی در سطحِ نما ذخیره می‌شود، نه فقط فایلِ نهایی.**
 * کاربر باید بتواند یک نما را جدا ببیند و فقط همان یکی را دوباره بسازد.
 */
async function upsertClipAsset(prisma: PrismaClient, job: JobWithContext, clip: StepOutput) {
  const existing = await prisma.asset.findFirst({
    where: { userId: job.group.userId, sha256: clip.hash, role: 'shot_output' },
  });
  if (existing) return existing;

  return prisma.asset.create({
    data: {
      userId: job.group.userId,
      projectId: job.shot.sequence.project.id,
      kind: 'CLIP',
      role: 'shot_output',
      storageKey: clip.key,
      mimeType: 'video/mp4',
      byteSize: clip.byteSize,
      sha256: clip.hash,
      durationSec: clip.durationSec,
    },
  });
}
