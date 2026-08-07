# ─── FlowStudio · وب (Next.js standalone) ───
#
# 🔴 تلهٔ بی‌صدا — چرا WORKDIR اینجا /app نیست:
# مسیرِ `app/app/page.tsx` (یعنی روتِ /app) وقتی ریشهٔ پروژه هم `/app` باشد،
# Next را گمراه می‌کند: بیلد **بدونِ هیچ خطا یا هشداری** صفحهٔ `/` را با محتوای
# `/app` می‌سازد. جدولِ Route هم سبز است، فقط اندازهٔ `/` برابرِ `/app` می‌شود.
# روی مک (ریشهٔ پروژه apps/web) درست بیلد می‌شود و فقط داخلِ داکر خراب می‌شود —
# پس تا روی سرور نروی نمی‌بینی‌اش. با /srv/web تصادم برداشته می‌شود.
# اگر روزی WORKDIR را عوض کردی، اول جدولِ Route را نگاه کن:
#   `/` باید اندازه‌اش با `/app` فرق داشته باشد.

FROM node:22-alpine AS deps
WORKDIR /srv/web
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /srv/web
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /srv/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /srv/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /srv/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /srv/web/.next/static ./.next/static

# سرنخ‌های فرمِ تماس اینجا می‌نشینند؛ در compose به والیوم وصل می‌شود.
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs
EXPOSE 3100
CMD ["node", "server.js"]
