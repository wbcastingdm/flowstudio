/**
 * قراردادِ قابلیتِ مدل — منطبق با apps/api/prisma/schema.prisma (AiModel).
 * مدل یک ردیفِ داده است، نه شاخهٔ کد (docs/00 بندِ ۹؛ گاردریلِ منشورِ اجرا).
 * هیچ نامِ مدلی در کدِ FlowStudio hard-code نمی‌شود — همیشه از اینجا خوانده می‌شود.
 */

export type Modality = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO';

export type CameraControlLevel = 'NONE' | 'BASIC' | 'FULL';

export type RegionReachable = 'IRAN' | 'HETZNER' | 'BOTH';

/** پنج فیلدِ اجباریِ قراردادِ قابلیت (docs/00 بندِ ۲-۸). */
export interface ModelCapability {
  maxDurationSec: number | null; // فقط برایِ VIDEO
  acceptsSeed: boolean;
  cameraControl: CameraControlLevel;
  commercialUse: boolean;
  regionReachable: RegionReachable;
}

export interface AiModelDescriptor {
  id: string;
  providerId: string;
  modelKey: string;
  modality: Modality;
  costPerUnit: number; // سکه — D-005
  capability: ModelCapability;
}

export interface AiProviderDescriptor {
  id: string;
  name: string;
  baseUrl: string;
  /** هرگز مقدارِ خام — این تایپ فقط شکلِ داده را نشان می‌دهد. */
  apiKeyEncrypted: string;
}

/**
 * فیلترِ اولیهٔ کاندیداها پیش از هر روتینگ — گاردریلِ منشورِ اجرا شمارهٔ ۵:
 * «اگر مدلی commercialUse=false است، روتر هرگز آن را انتخاب نکند —
 * حتی اگر ارزان‌ترین باشد.»
 */
export function filterEligibleModels(
  models: AiModelDescriptor[],
  opts: { modality: Modality; region: RegionReachable; requireCommercial: boolean },
): AiModelDescriptor[] {
  return models.filter((m) => {
    if (m.modality !== opts.modality) return false;
    if (opts.requireCommercial && !m.capability.commercialUse) return false;
    if (
      m.capability.regionReachable !== 'BOTH' &&
      m.capability.regionReachable !== opts.region
    ) {
      return false;
    }
    return true;
  });
}
