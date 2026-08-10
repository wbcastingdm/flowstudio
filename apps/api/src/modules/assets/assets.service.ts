import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from './storage.service';
import type { AssetKind } from '@prisma/client';

/** حداقلی که از یک فایل آپلودشده لازم داریم — بدون وابستگی به تایپ multer. */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * سیاست پذیرش هر جنس ورودی.
 *
 * سقف‌ها محافظه‌کارانه‌اند و در یک جا جمع شده‌اند تا بالا بردنشان یک تصمیم
 * آگاهانه باشد، نه یک عدد پراکنده در وسط کد.
 */
const POLICY: Record<
  AssetKind,
  { maxBytes: number; mimes: string[]; label: string; extFor: (m: string) => string }
> = {
  TEXT: {
    maxBytes: 2 * 1024 * 1024,
    mimes: ['text/plain', 'text/markdown', 'application/octet-stream'],
    label: 'فایل متنی',
    extFor: () => 'txt',
  },
  IMAGE: {
    maxBytes: 15 * 1024 * 1024,
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    label: 'عکس',
    extFor: (m) => (m === 'image/png' ? 'png' : m === 'image/webp' ? 'webp' : 'jpg'),
  },
  CLIP: {
    maxBytes: 200 * 1024 * 1024,
    mimes: ['video/mp4', 'video/quicktime', 'video/webm'],
    label: 'کلیپ',
    extFor: (m) => (m === 'video/webm' ? 'webm' : m === 'video/quicktime' ? 'mov' : 'mp4'),
  },
  AUDIO: {
    maxBytes: 50 * 1024 * 1024,
    mimes: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac'],
    label: 'فایل صوتی',
    extFor: (m) => (m === 'audio/wav' ? 'wav' : 'mp3'),
  },
};

/** نقش‌های شناخته‌شده. تاکسونومی بسته، مثل بقیه رجیستری‌های پروژه. */
const ROLES = [
  'input_script',
  'reference_image',
  'face',
  'base_clip',
  'music',
  'shot_output',
  'final_output',
] as const;
type AssetRole = (typeof ROLES)[number];

/** کدام نقش با کدام جنس جور است — تا عکس به جای کلیپ پایه ننشیند. */
const ROLE_KINDS: Record<AssetRole, AssetKind[]> = {
  input_script: ['TEXT'],
  reference_image: ['IMAGE'],
  face: ['IMAGE'],
  base_clip: ['CLIP'],
  music: ['AUDIO'],
  shot_output: ['IMAGE', 'CLIP'],
  final_output: ['CLIP', 'IMAGE'],
};

/**
 * لایه ۱ معماری — ورودی و دارایی.
 *
 * می‌داند چطور فایل بگیرد و شناسنامه‌دارش کند. **نمی‌داند محتوا برای چیست**:
 * هیچ ارجاعی به نوع تولید یا مدل AI این‌جا نیست.
 */
@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async upload(
    userId: string,
    file: UploadedFile | undefined,
    opts: { kind: string; role: string; projectId?: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('فایلی فرستاده نشد.');
    }

    const kind = this.normalizeKind(opts.kind);
    const role = this.normalizeRole(opts.role, kind);
    const policy = POLICY[kind];

    if (file.size > policy.maxBytes) {
      throw new BadRequestException(
        `${policy.label} تا ${Math.round(policy.maxBytes / 1024 / 1024)} مگابایت پذیرفته می‌شود؛ این فایل ${Math.round(file.size / 1024 / 1024)} مگابایت است.`,
      );
    }

    // نوع اعلامی مرورگر ملاک نهایی نیست: برای متن، محتوا هم بررسی می‌شود.
    if (!policy.mimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `${policy.label} باید یکی از این قالب‌ها باشد: ${policy.mimes.join('، ')}`,
      );
    }

    if (opts.projectId) {
      const owned = await this.prisma.project.findFirst({
        where: { id: opts.projectId, userId },
        select: { id: true },
      });
      if (!owned) throw new NotFoundException('پروژه پیدا نشد.');
    }

    let extractedText: string | null = null;
    if (kind === 'TEXT') {
      extractedText = this.extractText(file);
    }

    const sha256 = this.storage.sha256(file.buffer);

    // فایل تکراری همان کاربر دوباره روی دیسک نمی‌نشیند، ولی یک ردیف تازه
    // می‌گیرد: ممکن است این بار نقش دیگری داشته باشد یا به پروژه دیگری بخورد.
    const existing = await this.prisma.asset.findFirst({
      where: { userId, sha256 },
      select: { storageKey: true },
    });

    const storageKey = existing?.storageKey ?? this.storage.buildKey(userId, sha256, policy.extFor(file.mimetype));
    if (!existing) {
      await this.storage.write(storageKey, file.buffer);
    }

    return this.prisma.asset.create({
      data: {
        userId,
        projectId: opts.projectId ?? null,
        kind,
        role,
        storageKey,
        mimeType: file.mimetype,
        byteSize: file.size,
        sha256,
        extractedText,
      },
      select: {
        id: true,
        kind: true,
        role: true,
        mimeType: true,
        byteSize: true,
        extractedText: true,
        createdAt: true,
      },
    });
  }

  /** آرشیو رسانه کاربر — فقط دارایی خودش. */
  async list(userId: string, opts: { projectId?: string; kind?: string; role?: string } = {}) {
    return this.prisma.asset.findMany({
      where: {
        userId,
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
        ...(opts.kind ? { kind: this.normalizeKind(opts.kind) } : {}),
        ...(opts.role ? { role: opts.role } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        kind: true,
        role: true,
        mimeType: true,
        byteSize: true,
        durationSec: true,
        width: true,
        height: true,
        projectId: true,
        createdAt: true,
      },
    });
  }

  /**
   * خواندن فایل. `userId` در شرط است، نه فقط شناسه — دارایی کاربر دیگر
   * حتی با شناسه درست هم خوانده نمی‌شود.
   */
  async readForUser(userId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, userId },
    });
    if (!asset) throw new NotFoundException('دارایی پیدا نشد.');
    const buffer = await this.storage.read(asset.storageKey);
    return { asset, buffer };
  }

  async remove(userId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, userId } });
    if (!asset) throw new NotFoundException('دارایی پیدا نشد.');

    await this.prisma.asset.delete({ where: { id: asset.id } });

    // فایل فقط وقتی از دیسک می‌رود که هیچ ردیف دیگری به همان کلید اشاره
    // نکند — چون فایل تکراری عمدا یک بار ذخیره می‌شود.
    const stillUsed = await this.prisma.asset.count({ where: { storageKey: asset.storageKey } });
    if (stillUsed === 0) await this.storage.remove(asset.storageKey);

    return { removed: asset.id, fileDeleted: stillUsed === 0 };
  }

  /**
   * استخراج متن.
   *
   * فعلا فقط متن ساده و markdown. PDF و DOCX کتابخانه جدا می‌خواهند و
   * افزودن وابستگی سنگین بدون تصمیم درست نیست — پس به جای خرابی بی‌صدا،
   * پیام روشن داده می‌شود.
   */
  private extractText(file: UploadedFile): string {
    const head = file.buffer.subarray(0, 5).toString('binary');
    if (head.startsWith('%PDF')) {
      throw new BadRequestException(
        'فایل PDF فعلا پشتیبانی نمی‌شود. متن را در قالب txt یا مستقیم در کادر ایده بگذار.',
      );
    }
    if (file.buffer.subarray(0, 2).toString('binary') === 'PK') {
      throw new BadRequestException(
        'فایل ورد فعلا پشتیبانی نمی‌شود. متن را در قالب txt یا مستقیم در کادر ایده بگذار.',
      );
    }

    const text = file.buffer.toString('utf8');
    // بایت جایگزین یعنی محتوا UTF-8 نبوده؛ خروجی‌اش متن به‌هم‌ریخته می‌شد.
    if (text.includes('�')) {
      throw new BadRequestException('متن فایل با UTF-8 خوانده نشد. فایل را با کدگذاری UTF-8 ذخیره کن.');
    }
    if (!text.trim()) {
      throw new BadRequestException('فایل متنی خالی است.');
    }
    return text;
  }

  private normalizeKind(raw: string): AssetKind {
    const upper = (raw ?? '').toUpperCase().trim() as AssetKind;
    if (!(upper in POLICY)) {
      throw new BadRequestException(`جنس دارایی باید یکی از ${Object.keys(POLICY).join('، ')} باشد.`);
    }
    return upper;
  }

  private normalizeRole(raw: string, kind: AssetKind): AssetRole {
    const role = (raw ?? '').trim() as AssetRole;
    if (!ROLES.includes(role)) {
      throw new BadRequestException(`نقش دارایی باید یکی از ${ROLES.join('، ')} باشد.`);
    }
    if (!ROLE_KINDS[role].includes(kind)) {
      throw new BadRequestException(
        `نقش «${role}» با جنس ${kind} نمی‌خواند؛ این نقش ${ROLE_KINDS[role].join(' یا ')} می‌خواهد.`,
      );
    }
    return role;
  }
}
