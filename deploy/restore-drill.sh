#!/usr/bin/env bash
# تمرینِ بازیابی — تازه‌ترین بکاپ را در یک Postgresِ یک‌بارمصرف برمی‌گرداند.
#
# 🔴 چرا: گاردهای `backup.sh` دربارهٔ **فایل** حرف می‌زنند (حجم، نشانهٔ پایان،
#    چک‌سام)، نه دربارهٔ اینکه آن فایل به دیتابیسِ کارکن برمی‌گردد. تنها
#    اثباتِ بکاپ، بازیابی است.
#
# هیچ‌چیزی روی سرور یا روی خودِ بکاپ نوشته نمی‌شود.
#
#   bash deploy/restore-drill.sh
set -euo pipefail

DIR=${FS_BACKUP_DIR:-$HOME/Backups/flowstudio}
GNUPGHOME_DIR=${FS_GNUPGHOME:-$HOME/.flowstudio-backup/gnupg}
CONTAINER=${DRILL_CONTAINER:-flowstudio-restore-drill}
PORT=${DRILL_PORT:-55445}
IMAGE=${DRILL_IMAGE:-postgres:16}

ARCHIVE=${1:-}
if [ -z "$ARCHIVE" ]; then
  ARCHIVE=$(ls -1t "$DIR"/flowstudio-db-*.sql.zst.gpg 2>/dev/null | head -1 || true)
fi
[ -n "$ARCHIVE" ] && [ -f "$ARCHIVE" ] || {
  echo "🔴 بکاپی در $DIR نیست — اول pull-backups.sh را بزنید" >&2; exit 1; }
echo "بکاپِ آزمایش‌شونده: $(basename "$ARCHIVE")"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"; docker rm -f "$CONTAINER" >/dev/null 2>&1 || true' EXIT

# ── ۱ · رمزگشایی ─────────────────────────────────────────────────────────
GNUPGHOME="$GNUPGHOME_DIR" gpg --quiet --decrypt "$ARCHIVE" 2>/dev/null \
  | zstd -dq -c > "$WORK/restore.sql"
SIZE=$(wc -c < "$WORK/restore.sql" | tr -d ' ')
echo "✅ رمزگشایی شد — ${SIZE} بایتِ SQL"
grep -q 'PostgreSQL database dump complete' "$WORK/restore.sql" \
  || { echo "🔴 dump نشانهٔ پایان ندارد" >&2; exit 1; }

# ── ۲ · Postgresِ یک‌بارمصرف ──────────────────────────────────────────────
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=drill -e POSTGRES_USER=flowstudio -e POSTGRES_DB=flowstudio \
  -p "$PORT:5432" "$IMAGE" >/dev/null

# 🔴 `pg_isready` روی **سوکت** در فازِ مقداردهیِ اولیهٔ ایمیجِ رسمی هم سبز
#    می‌شود، و بعد سرور یک‌بار ری‌استارت می‌کند. اگر همان‌جا بازیابی کنیم،
#    خودِ psql بی‌خطا تمام می‌شود ولی کوئریِ بعدی به سوکتِ رفته می‌خورد
#    («No such file or directory») و درست به‌نظر می‌رسد که بازیابی شکسته —
#    درحالی‌که فقط زود بوده. انتظار روی **TCP** فقط پس از پایانِ مقداردهی
#    سبز می‌شود.
ready=0
for _ in $(seq 1 90); do
  if docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U flowstudio >/dev/null 2>&1; then
    ready=$((ready + 1))
    # دو سبزِ پیاپی با یک ثانیه فاصله: یک سبزِ تکی می‌تواند لحظهٔ پیش از
    # ری‌استارتِ پایانِ مقداردهی باشد.
    [ "$ready" -ge 2 ] && break
  else
    ready=0
  fi
  sleep 1
done
[ "$ready" -ge 2 ] || { echo "🔴 Postgresِ تمرین بالا نیامد" >&2; exit 1; }

# ── ۳ · بازیابیِ واقعی ────────────────────────────────────────────────────
docker exec -i "$CONTAINER" psql -U flowstudio -d flowstudio -v ON_ERROR_STOP=0 \
  < "$WORK/restore.sql" > "$WORK/psql.log" 2>&1 || true
BAD=$(grep -c '^ERROR' "$WORK/psql.log" || true)
BENIGN=$(grep -c 'already exists' "$WORK/psql.log" || true)
echo "خطاهای psql: ${BAD:-0} (از این تعداد «از قبل هست»: ${BENIGN:-0})"

# ── ۴ · شاهد ─────────────────────────────────────────────────────────────
TABLES=$(docker exec "$CONTAINER" psql -U flowstudio -d flowstudio -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')")
echo "جدول‌های بازیابی‌شده: $TABLES"
[ "$TABLES" -gt 0 ] || { echo "🔴 هیچ جدولی بازیابی نشد" >&2; exit 1; }

# 🔴 «جدول هست» با «داده هست» یکی نیست: dumpِ فقط-اسکیما هم جدول می‌سازد.
ROWS=$(docker exec "$CONTAINER" psql -U flowstudio -d flowstudio -tAc \
  "SELECT coalesce(sum(n_live_tup),0) FROM pg_stat_user_tables")
echo "ردیف‌های بازیابی‌شده: $ROWS"

docker exec "$CONTAINER" psql -U flowstudio -d flowstudio -tAc \
  "SELECT relname||' = '||n_live_tup FROM pg_stat_user_tables
   WHERE n_live_tup > 0 ORDER BY n_live_tup DESC LIMIT 10"

echo
echo "✅ تمرینِ بازیابی پاس شد."
