#!/usr/bin/env bash
# بکاپِ رمزشدهٔ فلواستودیو — روی سرور اجرا می‌شود (کرانِ شبانه).
#
# 🔴 رمزگذاری **نامتقارن** است: سرور فقط کلیدِ عمومی دارد و نمی‌تواند
#    بکاپ‌های خودش را باز کند. کلیدِ خصوصی روی ماشینِ مالک است.
#    یعنی دسترسی به سرور ≠ دسترسی به تاریخچهٔ داده.
#
# 🔴 دو چیز بکاپ می‌شود، نه یکی:
#      postgres  — پروژه‌ها، کاربران، کیفِ پول، دفترِ کل
#      fs_storage — داراییِ کاربر (ویدیو، تصویر). این‌ها **بازتولیدشدنی نیستند**
#    بکاپی که فقط دیتابیس را بگیرد، بازیابی‌اش کتابخانه‌ای می‌سازد که هر
#    ردیفش به فایلی اشاره می‌کند که وجود ندارد.
set -euo pipefail

PG_CONTAINER=${FS_PG_CONTAINER:-flowstudio_postgres}
API_CONTAINER=${FS_API_CONTAINER:-flowstudio_api}
DB=${POSTGRES_DB:-flowstudio}
DB_USER=${POSTGRES_USER:-flowstudio}
OUT=${FS_BACKUP_OUT:-/opt/flowstudio/backups}
RECIPIENT=${FS_BACKUP_RECIPIENT:-backup@flowstudio.ir}
KEEP=${FS_BACKUP_KEEP:-14}
STORAGE_DIR=${FS_STORAGE_DIR:-/data/storage}
MIN_BYTES=${FS_BACKUP_MIN_BYTES:-8000}

mkdir -p "$OUT"
chmod 700 "$OUT"

STAMP=$(date -u +%Y%m%d-%H%M%SZ)
RAW=$(mktemp /tmp/flowstudio-dump.XXXXXX.sql)
trap 'rm -f "$RAW"' EXIT

# نقش‌ها + خودِ دیتابیس در یک جریان، تا بازیابی روی ماشینِ خالی هم کار کند
docker exec "$PG_CONTAINER" pg_dumpall -U "$DB_USER" --globals-only   >  "$RAW"
docker exec "$PG_CONTAINER" pg_dump    -U "$DB_USER" -d "$DB" --clean --if-exists >> "$RAW"

# ── دو گاردِ سلامت ────────────────────────────────────────────────────────
# 🔴 بکاپِ خرابِ بی‌صدا از نبودِ بکاپ بدتر است: به آن تکیه می‌کنی.
SIZE=$(wc -c < "$RAW" | tr -d ' ')
if [ "$SIZE" -lt "$MIN_BYTES" ]; then
  echo "خطا: dump فقط $SIZE بایت است (کمتر از $MIN_BYTES) — بکاپ رد شد" >&2
  exit 1
fi
if ! grep -q 'PostgreSQL database dump complete' "$RAW"; then
  echo "خطا: dump ناتمام است — نشانهٔ پایان را ندارد" >&2
  exit 1
fi

DEST="$OUT/flowstudio-db-$STAMP.sql.zst.gpg"
zstd -19 -q -c "$RAW" \
  | gpg --batch --yes --trust-model always --encrypt --recipient "$RECIPIENT" \
        --output "$DEST"
chmod 600 "$DEST"
shasum -a 256 "$DEST" | awk '{print $1"  "'"'"$(basename "$DEST")"'"'}' > "$DEST.sha256" 2>/dev/null \
  || sha256sum "$DEST" | awk -v n="$(basename "$DEST")" '{print $1"  "n}' > "$DEST.sha256"

# ── داراییِ کاربر ─────────────────────────────────────────────────────────
# از داخلِ کانتینر خوانده می‌شود چون والیوم آن‌جا مانت است. `--warning=no-file-changed`
# چون کاربر ممکن است همان لحظه آپلود کند و tar روی فایلِ در حالِ نوشتن ۱ برمی‌گرداند
# — که با `set -e` کلِ بکاپ را می‌کشت، بدونِ اینکه چیزی واقعاً خراب باشد.
ASSETS="$OUT/flowstudio-assets-$STAMP.tar.zst.gpg"
if docker exec "$API_CONTAINER" test -d "$STORAGE_DIR" 2>/dev/null; then
  docker exec "$API_CONTAINER" tar -C "$STORAGE_DIR" --warning=no-file-changed -cf - . 2>/dev/null \
    | zstd -10 -q -c \
    | gpg --batch --yes --trust-model always --encrypt --recipient "$RECIPIENT" \
          --output "$ASSETS" || true
  if [ -s "$ASSETS" ]; then
    chmod 600 "$ASSETS"
    sha256sum "$ASSETS" 2>/dev/null | awk -v n="$(basename "$ASSETS")" '{print $1"  "n}' > "$ASSETS.sha256" \
      || shasum -a 256 "$ASSETS" | awk -v n="$(basename "$ASSETS")" '{print $1"  "n}' > "$ASSETS.sha256"
  else
    echo "هشدار: بکاپِ دارایی خالی درآمد — بررسی کنید" >&2
    rm -f "$ASSETS"
  fi
else
  echo "هشدار: $STORAGE_DIR در $API_CONTAINER پیدا نشد — بکاپِ دارایی رد شد" >&2
fi

# ── هرس ──────────────────────────────────────────────────────────────────
# روی همان مسیری که رشد از آن می‌آید. دیسکِ پر یک‌بار Postgres را خواباند.
#
# 🔴 `|| true` روی `ls` حیاتی است: با `set -o pipefail`، اگر هیچ فایلی با
#    الگو نخواند `ls` غیرِ صفر برمی‌گرداند و کلِ لوله شکست‌خورده حساب می‌شود
#    ⇒ `set -e` اسکریپت را همان‌جا می‌کشد. یعنی **اولین اجرا** — که هنوز
#    هیچ بکاپِ دارایی‌ای ندارد — پیش از ساختِ `LATEST` می‌مرد، درحالی‌که
#    فایلِ بکاپ ساخته شده بود و پوشه سالم به‌نظر می‌رسید.
prune() {
  local pattern="$1"
  local files
  files=$(ls -1t $pattern 2>/dev/null || true)
  [ -n "$files" ] || return 0
  printf '%s\n' "$files" | tail -n +"$((KEEP + 1))" | while read -r old; do
    [ -n "$old" ] && rm -f "$old" "$old.sha256"
  done
}
prune "$OUT/flowstudio-db-*.sql.zst.gpg"
prune "$OUT/flowstudio-assets-*.tar.zst.gpg"

ln -sfn "$(basename "$DEST")" "$OUT/LATEST"
echo "✅ بکاپ گرفته شد: $(basename "$DEST") ($(wc -c < "$DEST" | tr -d ' ') بایت)"
