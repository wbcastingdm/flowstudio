# ─── FlowStudio · API (NestJS + Prisma) ───
# ⚠️ کانتکستِ بیلد ریشهٔ مخزن است (نه apps/api) — چون npm workspaces است.
# WORKDIR عمداً /srv/api است، نه /app (همان تلهٔ Next در apps/web؛ اینجا لازم
# نیست ولی برایِ یکدستی نگه داشته شده).

FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /srv/api
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/ir/package.json ./packages/ir/
COPY packages/registry/package.json ./packages/registry/
RUN npm ci --ignore-scripts
COPY apps/api ./apps/api
COPY packages ./packages
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
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
EXPOSE 3200
CMD ["node", "dist/src/main.js"]
