#!/usr/bin/env bash
# کشیدنِ بکاپ‌ها از سرور به ماشینِ مالک.
#
# 🔴 بکاپی که فقط روی همان سروری است که ازش گرفته شده، بکاپ نیست.
set -euo pipefail

HOST=${FS_SSH_HOST:?FS_SSH_HOST را ست کنید (مثلاً root@1.2.3.4)}
SRC=${FS_BACKUP_OUT:-/opt/flowstudio/backups}
DEST=${FS_BACKUP_DIR:-$HOME/Backups/flowstudio}

mkdir -p "$DEST"
chmod 700 "$DEST"

# ⚠️ فقط پرچم‌های سازگار: مک‌اواس rsync 2.6.9 دارد و `--info` را نمی‌شناسد.
# (درسِ اتیکو: دستی کار می‌کرد چون MacPorts جلوی PATH بود، زیرِ launchd نه.)
rsync -az "$HOST:$SRC/" "$DEST/"

# ── راستی‌آزماییِ چک‌سام — انتقالِ خرابِ بی‌صدا را می‌گیرد ──
cd "$DEST"
fail=0
count=0
for f in flowstudio-*.gpg; do
  [ -e "$f" ] || continue
  count=$((count + 1))
  if [ ! -f "$f.sha256" ]; then
    echo "⚠️  بدونِ چک‌سام: $f"; fail=1; continue
  fi
  want=$(awk '{print $1}' "$f.sha256")
  got=$(shasum -a 256 "$f" | awk '{print $1}')
  if [ "$want" != "$got" ]; then
    echo "🔴 چک‌سام نمی‌خواند: $f"; fail=1
  fi
done

echo "بکاپ‌های محلی: $count"
[ "$fail" -eq 0 ] || { echo "🔴 راستی‌آزمایی شکست خورد" >&2; exit 1; }
echo "✅ همهٔ چک‌سام‌ها درست‌اند"
