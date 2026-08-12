import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import type { PrismaClient } from '@prisma/client';
import { config } from './config';
import { engines } from './engines';
import { concatClips, probeDurationSec } from './render/ffmpeg';
import { load, store } from './storage';

/**
 * بستنِ گروه — کلیپ‌های نما به یک فایلِ نهایی می‌چسبند.
 *
 * 🔒 **قفلِ مسابقه.** دو کارگر می‌توانند هم‌زمان آخرین دو کارِ یک گروه را
 * ببندند و هر دو ببینند «همه تمام شد». بدونِ قفل، هر دو مونتاژ می‌کنند: دو
 * فایلِ نهایی، دو ردیفِ دارایی، و یکی از آن‌ها بی‌صدا گم می‌شود.
 * `updateMany … WHERE finalizedAt IS NULL` یک دستورِ اتمیک است: دقیقاً یکی
 * `count = 1` می‌گیرد و بقیه دست خالی برمی‌گردند.
 *
 * ⚠️ قفل **پیش از** کار گرفته می‌شود، نه بعدش. اگر مونتاژ شکست بخورد قفل
 * پس داده می‌شود تا کارِ بعدی دوباره تلاش کند — وگرنه یک شکستِ گذرا گروه را
 * تا ابد بی‌فایلِ نهایی می‌گذاشت.
 */
export async function finalizeGroupIfReady(
  prisma: PrismaClient,
  groupId: string,
): Promise<{ finalized: boolean; assetId?: string; reason?: string }> {
  const pending = await prisma.job.count({
    where: { groupId, status: { in: ['PENDING', 'RUNNING'] } },
  });
  if (pending > 0) return { finalized: false, reason: `${pending} کار هنوز مانده` };

  const failed = await prisma.job.count({ where: { groupId, status: 'FAILED' } });
  if (failed > 0) {
    // فایلِ نهایی از نماهای ناقص ساخته نمی‌شود. یک ویدیوی نصفه که «تمام
    // شد» صدا می‌زند، از یک خطای صریح بدتر است.
    return { finalized: false, reason: `${failed} نما شکست خورده — مونتاژ انجام نمی‌شود` };
  }

  const claimed = await prisma.jobGroup.updateMany({
    where: { id: groupId, finalizedAt: null },
    data: { finalizedAt: new Date() },
  });
  if (claimed.count !== 1) return { finalized: false, reason: 'کارگرِ دیگری زودتر بست' };

  try {
    const assetId = await montage(prisma, groupId);
    return { finalized: true, assetId };
  } catch (err) {
    await prisma.jobGroup.updateMany({
      where: { id: groupId },
      data: { finalizedAt: null },
    });
    throw err;
  }
}

async function montage(prisma: PrismaClient, groupId: string): Promise<string> {
  const group = await prisma.jobGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      jobs: {
        include: {
          shot: { select: { id: true, order: true, sequence: { select: { order: true } } } },
          generations: {
            where: { resultUrl: { not: null }, modelKeySnap: { startsWith: 'programmatic_motion' } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  // ترتیبِ روایت: اول سکانس، بعد نما. ترتیبِ ساخته‌شدن ملاک نیست — کارها
  // ممکن است موازی تمام شوند و آن‌وقت فیلم به‌هم‌ریخته چسبیده می‌شود.
  const ordered = [...group.jobs].sort((a, b) => {
    const seq = a.shot.sequence.order - b.shot.sequence.order;
    return seq !== 0 ? seq : a.shot.order - b.shot.order;
  });

  const clips = ordered
    .map((job) => job.generations[0]?.resultUrl)
    .filter((key): key is string => Boolean(key));
  if (clips.length === 0) throw new Error('هیچ کلیپی برایِ مونتاژ پیدا نشد.');

  const workDir = join(config.tmpDir, `final-${groupId}`);
  await mkdir(workDir, { recursive: true });

  try {
    const localPaths: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const path = join(workDir, `${String(i).padStart(3, '0')}.mp4`);
      await writeFile(path, await load(clips[i]));
      localPaths.push(path);
    }

    // فهرستِ concat: تک‌کوتیشن داخلِ مسیر باید escape شود، وگرنه یک نامِ
    // فایلِ عجیب کلِ فهرست را می‌شکند.
    const listPath = join(workDir, 'list.txt');
    await writeFile(
      listPath,
      localPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'),
      'utf8',
    );

    const outputPath = join(workDir, 'final.mp4');
    await concatClips(listPath, outputPath);

    const buffer = await readFile(outputPath);
    const saved = await store(group.userId, buffer, 'mp4');
    const durationSec = await probeDurationSec(outputPath);
    const engine = await engines();

    const asset = await prisma.asset.create({
      data: {
        userId: group.userId,
        projectId: group.projectId,
        kind: 'CLIP',
        role: 'final_output',
        storageKey: saved.key,
        mimeType: 'video/mp4',
        byteSize: saved.byteSize,
        sha256: saved.hash,
        durationSec,
      },
    });

    await prisma.jobGroup.update({
      where: { id: groupId },
      data: { finalAssetId: asset.id },
    });

    // مونتاژ هم یک گامِ تولید است و ردیفِ خودش را می‌خواهد — وگرنه در گزارشِ
    // هزینه، فایلی وجود دارد که هیچ‌کس نساخته است.
    const lastJob = ordered[ordered.length - 1];
    await prisma.generation.create({
      data: {
        jobId: lastJob.id,
        shotId: lastJob.shot.id,
        modelVersion: engine.ffmpeg,
        modelKeySnap: 'montage@ffmpeg/concat',
        paramHash: saved.hash,
        resultUrl: saved.key,
        resultHash: saved.hash,
        costActual: 0,
        outputDurationSec: durationSec,
      },
    });

    return asset.id;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
