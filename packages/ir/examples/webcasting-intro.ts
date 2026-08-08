/**
 * آزمونِ پذیرش برایِ ProjectIR/SequenceIR/ShotIR (منشورِ اجرا، بخشِ ۱۰-۳):
 * «یک نمای واقعی از یکی از ویدیوهای معرفیِ ~/Projects/ads کاملاً در ShotIR
 * نوشته شود، بدونِ نیاز به هیچ فیلدِ notes آزاد.»
 *
 * منبع: ~/Projects/ads/معرفی-تصویری/۰۱ - وبکستینگ.html — متنِ واقعیِ
 * روی‌صفحه استخراج شد (هیچ متنی ساخته نشده): «سایت در چند دقیقه، کسب‌وکار
 * در ۲۴ ماژول» / «سایت‌سازی که فقط صفحه نمی‌سازد …» / «وبکستینگ» /
 * «webcasting.ir» / «با ما در تماس باش».
 *
 * نتیجه: پنج نما، هرکدام کاملاً در فیلدهای typed جا شد. فیلدِ آزادِ
 * description همان متنِ روی‌صفحه است، نه توضیحِ اضافه — همان چیزی که
 * منشورِ اجرا بخشِ ۹ ایرادِ ۸ اجازه داده بود.
 */

import { ProjectIR, totalDurationSec } from '../src/index';

export const webcastingIntroExample: ProjectIR = {
  id: 'proj-webcasting-intro-ref',
  title: 'معرفیِ تصویریِ وبکستینگ (نمونهٔ مرجع)',
  goal: 'BRAND_AWARENESS',
  tone: 'PROFESSIONAL',
  sequences: [
    {
      id: 'seq-1',
      projectId: 'proj-webcasting-intro-ref',
      order: 1,
      title: 'قلاب و برند',
      shots: [
        {
          id: 'shot-1',
          sequenceId: 'seq-1',
          order: 1,
          durationSec: 3,
          description: 'سایت در چند دقیقه. کسب‌وکار در ۲۴ ماژول.',
          cameraMovement: 'STATIC',
          aspectRatio: '16:9',
          seed: null,
          continuityRef: null,
          appliedRules: [
            {
              ruleCode: 'ABCD-HOOK-3S',
              evidenceClass: 'E',
              accepted: true,
            },
          ],
          status: 'DRAFT',
        },
        {
          id: 'shot-2',
          sequenceId: 'seq-1',
          order: 2,
          durationSec: 5,
          description:
            'سایت‌سازی که فقط صفحه نمی‌سازد — فروشگاه، مالی، دوره، تور، رسانه و CRM را روی یک سایت روشن می‌کند.',
          cameraMovement: 'PAN',
          aspectRatio: '16:9',
          seed: null,
          continuityRef: null,
          appliedRules: [],
          status: 'DRAFT',
        },
        {
          id: 'shot-3',
          sequenceId: 'seq-1',
          order: 3,
          durationSec: 2,
          description: 'وبکستینگ',
          cameraMovement: 'STATIC',
          aspectRatio: '16:9',
          seed: null,
          continuityRef: null,
          appliedRules: [
            { ruleCode: 'ABCD-LOGO-3S', evidenceClass: 'E', accepted: true },
          ],
          status: 'DRAFT',
        },
        {
          id: 'shot-4',
          sequenceId: 'seq-1',
          order: 4,
          durationSec: 2,
          description: 'webcasting.ir',
          cameraMovement: 'STATIC',
          aspectRatio: '16:9',
          seed: null,
          continuityRef: null,
          appliedRules: [],
          status: 'DRAFT',
        },
        {
          id: 'shot-5',
          sequenceId: 'seq-1',
          order: 5,
          durationSec: 2,
          description: 'با ما در تماس باش',
          cameraMovement: 'STATIC',
          aspectRatio: '16:9',
          seed: null,
          continuityRef: null,
          appliedRules: [],
          status: 'DRAFT',
        },
      ],
    },
  ],
};

// جمعِ مدت: باید ۱۴ ثانیه شود (۳+۵+۲+۲+۲) — تیزرِ کوتاه، دقیقاً همان
// باریکهٔ اجرا (D-C11) که امروز هدفِ MVP است.
console.log('durationSec =', totalDurationSec(webcastingIntroExample));
