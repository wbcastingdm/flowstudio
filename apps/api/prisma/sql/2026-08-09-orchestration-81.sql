-- مهاجرتِ افزایشیِ سندِ ۸۱ (مدلِ ارکستراسیون + قراردادِ جدایش) — ۱۹ مرداد ۱۴۰۵
--
-- چرا دستی و نه `prisma db push --accept-data-loss`: آن پرچم کورکورانه هر
-- تغییری را می‌پذیرد، از جمله DROPِ ناخواسته. اینجا هر دستور افزایشی است —
-- هیچ ستونی حذف نمی‌شود، هیچ داده‌ای بازنویسی نمی‌شود، و همه‌شان
-- `IF NOT EXISTS` دارند تا اجرای دوباره بی‌ضرر باشد.

-- ─── User: هویت مالِ FlowStudio (بخشِ ۱۲) ───
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authProvider" TEXT NOT NULL DEFAULT 'otp';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
-- در پستگرس NULLها در ایندکسِ یکتا با هم تصادم نمی‌کنند، پس ردیف‌های
-- فعلیِ ('otp', NULL) همه معتبر می‌مانند.
CREATE UNIQUE INDEX IF NOT EXISTS "User_authProvider_externalId_key"
  ON "User"("authProvider", "externalId");

-- ─── Shot: سهم از پاکتِ بودجه (L2) ───
ALTER TABLE "Shot" ADD COLUMN IF NOT EXISTS "weight" INTEGER NOT NULL DEFAULT 100;

-- ─── JobGroup: وارونگیِ بودجه ───
-- D-O14: همه Int و سکه‌ای — دفتر هرگز اعشاری نمی‌شود.
ALTER TABLE "JobGroup" ADD COLUMN IF NOT EXISTS "budgetCap" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobGroup" ADD COLUMN IF NOT EXISTS "spentAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobGroup" ADD COLUMN IF NOT EXISTS "escalationCap" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "JobGroup" ADD COLUMN IF NOT EXISTS "qualityTier" TEXT NOT NULL DEFAULT 'standard';

-- ─── AiModel: قابلیتِ ریز + قیمتِ فهرستی (D-O15, D-O14) ───
ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "stepTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "listPricePerUnit" DECIMAL(14,6);
ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "listPriceCurrency" TEXT;

-- ─── PlanStep: گرافِ گام‌های قابلیت (L1) ───
CREATE TABLE IF NOT EXISTS "PlanStep" (
  "id"         TEXT NOT NULL,
  "jobGroupId" TEXT NOT NULL,
  "shotId"     TEXT,
  "capability" TEXT NOT NULL,
  "dependsOn"  JSONB,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanStep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlanStep_jobGroupId_idx" ON "PlanStep"("jobGroupId");
CREATE INDEX IF NOT EXISTS "PlanStep_shotId_idx" ON "PlanStep"("shotId");

-- ─── ModelScore: مشتق و بازمحاسبه‌شونده — هرگز دستی پر نمی‌شود ───
CREATE TABLE IF NOT EXISTS "ModelScore" (
  "id"         TEXT NOT NULL,
  "modelId"    TEXT NOT NULL,
  "stepType"   TEXT NOT NULL,
  "cpas"       DECIMAL(14,6) NOT NULL,
  "sampleSize" INTEGER NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ModelScore_modelId_stepType_key" ON "ModelScore"("modelId", "stepType");
CREATE INDEX IF NOT EXISTS "ModelScore_stepType_idx" ON "ModelScore"("stepType");

-- ─── Generation: ورودی‌های CPAS ───
-- بدونِ این دو، «هزینه به‌ازای ثانیهٔ پذیرفته‌شده» محاسبه‌ناپذیر است.
ALTER TABLE "Generation" ADD COLUMN IF NOT EXISTS "attemptIndex" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Generation" ADD COLUMN IF NOT EXISTS "supersedesId" TEXT;
ALTER TABLE "Generation" ADD COLUMN IF NOT EXISTS "planStepId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Generation_supersedesId_key" ON "Generation"("supersedesId");
CREATE INDEX IF NOT EXISTS "Generation_planStepId_idx" ON "Generation"("planStepId");

-- ─── کلیدهای خارجی ───
-- `DO $$` چون پستگرس برایِ ADD CONSTRAINT پشتیبانیِ IF NOT EXISTS ندارد.
DO $$ BEGIN
  ALTER TABLE "PlanStep" ADD CONSTRAINT "PlanStep_jobGroupId_fkey"
    FOREIGN KEY ("jobGroupId") REFERENCES "JobGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PlanStep" ADD CONSTRAINT "PlanStep_shotId_fkey"
    FOREIGN KEY ("shotId") REFERENCES "Shot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ModelScore" ADD CONSTRAINT "ModelScore_modelId_fkey"
    FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Generation" ADD CONSTRAINT "Generation_supersedesId_fkey"
    FOREIGN KEY ("supersedesId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Generation" ADD CONSTRAINT "Generation_planStepId_fkey"
    FOREIGN KEY ("planStepId") REFERENCES "PlanStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
