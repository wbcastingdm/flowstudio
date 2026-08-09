#!/usr/bin/env node
/**
 * اجرایِ مسیرِ ج روی یک تصویر و گزارشِ هزینهٔ واقعی.
 *
 *   node src/render.mjs --image in.png --out out.mp4 \
 *     --preset kenburns_in --aspect R9_16 --duration 8 [--grain] [--vignette]
 *
 * خروجیِ آخر یک خطِ JSON است تا در جدولِ هزینه بنشیند. با `--threads 1`
 * (پیش‌فرض) زمانِ دیواری **همان ثانیهٔ CPU** است — و هزینهٔ مسیرِ ج دقیقاً
 * همان است، چون هیچ فراخوانِ پولی ندارد.
 */
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { cpus } from 'node:os';
import { buildFfmpegArgs } from './presets.js';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const spec = {
  preset: String(arg('preset', 'kenburns_in')),
  aspect: String(arg('aspect', 'R9_16')),
  durationSec: Number(arg('duration', 8)),
  fps: Number(arg('fps', 30)),
  fadeSec: Number(arg('fade', 0.4)),
  crf: Number(arg('crf', 20)),
  threads: Number(arg('threads', 1)),
  encodePreset: String(arg('encode-preset', 'medium')),
  grain: arg('grain', false) === true,
  vignette: arg('vignette', false) === true,
};

const input = arg('image');
const output = arg('out');
if (!input || !output) {
  console.error('لازم: --image <ورودی> --out <خروجی>');
  process.exit(2);
}

const args = buildFfmpegArgs(spec, String(input), String(output));
const startedAt = process.hrtime.bigint();
const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], {
  stdio: ['ignore', 'inherit', 'inherit'],
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`ffmpeg با کدِ ${code} شکست خورد`);
    process.exit(code ?? 1);
  }
  const wallSec = Number(process.hrtime.bigint() - startedAt) / 1e9;
  const bytes = statSync(String(output)).size;

  console.log(
    JSON.stringify({
      preset: spec.preset,
      aspect: spec.aspect,
      durationSec: spec.durationSec,
      fps: spec.fps,
      threads: spec.threads,
      // با تک‌نخ، این عدد ثانیهٔ CPU هم هست.
      wallSec: Number(wallSec.toFixed(2)),
      cpuSecPerOutputSec: Number((wallSec / spec.durationSec).toFixed(3)),
      realtimeFactor: Number((spec.durationSec / wallSec).toFixed(2)),
      outputKb: Math.round(bytes / 1024),
      machine: `${cpus()[0]?.model ?? '?'} ×${cpus().length}`,
      aiCalls: 0,
      aiCostCoins: 0,
    }),
  );
});
