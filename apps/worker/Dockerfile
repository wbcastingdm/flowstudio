# ─── FlowStudio · کارگرِ صف ───
#
# ⚠️ کانتکستِ بیلد ریشهٔ مخزن است (نه apps/worker) — چون npm workspaces است.
# WORKDIR عمداً /srv/worker است، نه /app؛ همان قاعدهٔ یکدستِ دو ایمیجِ دیگر.

FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /srv/worker
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/ir/package.json ./packages/ir/
COPY packages/registry/package.json ./packages/registry/
COPY packages/ledger/package.json ./packages/ledger/
COPY packages/motion/package.json ./packages/motion/
RUN npm ci --ignore-scripts
COPY apps/api/prisma ./apps/api/prisma
COPY apps/worker ./apps/worker
COPY packages ./packages
# 🔴 شِما مالِ apps/api است ولی کلاینتِ تولیدشده مشترک است. بدونِ این خط،
# کارگر با «@prisma/client did not initialize yet» بالا نمی‌آید.
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=@flowstudio/ledger
RUN npm run build --workspace=@flowstudio/worker

FROM node:22-alpine AS runner
# 🔴 دو وابستگیِ سیستمیِ غیرقابلِ‌حذف:
#   • chromium — تنها موتوری که فارسی را درست می‌کشد. `drawtext`ِ ffmpeg
#     چسبشِ حروف و جهتِ راست‌به‌چپ را بی‌صدا خراب می‌کند.
#   • ffmpeg — حرکتِ برنامه‌ای و چسباندنِ کلیپ‌ها.
# فونتِ فارسی داخلِ ایمیج نصب نمی‌شود چون لایهٔ متن فونتش را به‌صورتِ
# data-URI درونِ خودِ HTML می‌برد (apps/worker/src/render/html.ts).
RUN apk add --no-cache openssl chromium ffmpeg
WORKDIR /srv/worker
ENV NODE_ENV=production
ENV CHROME_BIN=/usr/bin/chromium-browser
COPY --from=builder /srv/worker/node_modules ./node_modules
COPY --from=builder /srv/worker/apps/worker/dist ./dist
COPY --from=builder /srv/worker/apps/worker/assets ./assets
COPY --from=builder /srv/worker/packages ./packages
COPY --from=builder /srv/worker/package.json ./package.json
COPY --from=builder /srv/worker/apps/worker/package.json ./apps/worker/package.json

# پوشهٔ کارِ موقت. روی tmpfs نیست چون یک نمای ۱۰۸۰×۱۹۲۰ چند مگابایت است و
# رمِ سرورِ سه‌هسته‌ای را بی‌دلیل می‌خورد.
RUN mkdir -p /tmp/flowstudio-worker

CMD ["node", "dist/main.js"]
