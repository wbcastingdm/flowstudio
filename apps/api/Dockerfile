# ─── FlowStudio · API (NestJS + Prisma) ───
# ⚠️ کانتکستِ بیلد ریشهٔ مخزن است (نه apps/api) — چون npm workspaces است.
# WORKDIR عمداً /srv/api است، نه /app (همان تلهٔ Next در apps/web؛ اینجا لازم
# نیست ولی برایِ یکدستی نگه داشته شده).

FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /srv/api
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/ir/package.json ./packages/ir/
COPY packages/registry/package.json ./packages/registry/
COPY packages/ledger/package.json ./packages/ledger/
COPY packages/motion/package.json ./packages/motion/
RUN npm ci --ignore-scripts
COPY apps/api ./apps/api
COPY packages ./packages
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
# 🔴 ترتیب اجباری: دفترِ سکه باید **پیش از** API ساخته شود.
# `WalletService` از `@flowstudio/ledger` تایپ می‌خواند و آن تایپ‌ها فقط بعد
# از `tsc`ِ همان بسته وجود دارند. روی مک این خط لازم نبود چون بسته از قبل
# ساخته شده بود — پس نبودش **فقط داخلِ داکر** دیده می‌شد.
RUN npm run build --workspace=@flowstudio/ledger
RUN npm run build --workspace=@flowstudio/api

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /srv/api
ENV NODE_ENV=production
COPY --from=builder /srv/api/node_modules ./node_modules
COPY --from=builder /srv/api/apps/api/dist ./dist
COPY --from=builder /srv/api/apps/api/prisma ./prisma
COPY --from=builder /srv/api/package.json ./package.json
COPY --from=builder /srv/api/apps/api/package.json ./apps/api/package.json
# 🔴 بدونِ این خط، ایمیج **بی‌صدا** بیلد می‌شود و موقعِ اجرا کرش می‌کند:
# npm workspaces برایِ `node_modules/@flowstudio/ledger` یک symlink به
# `../../packages/ledger` می‌سازد. اگر `packages` کپی نشود، لینک به جایِ
# خالی اشاره می‌کند و کانتینر با «Cannot find module» بالا نمی‌آید.
COPY --from=builder /srv/api/packages ./packages
EXPOSE 3200
CMD ["node", "dist/src/main.js"]
