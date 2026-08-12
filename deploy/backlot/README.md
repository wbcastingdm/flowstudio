# Backlot روی `backlot.flowstudio.ir`

بردِ **خواندنیِ** OpenMontage — نشان می‌دهد یک تولیدِ ویدیو مرحله‌به‌مرحله چطور
پیش می‌رود: ریل مراحل، فیلم‌نامه، فیلم‌استریپِ نماها، دروازه‌های تأییدِ انسانی،
کنتورِ هزینه و فعالیتِ زنده.

**چرا این‌جاست:** ایتمِ `D-03B` و فازِ ۶ — سندِ
[`docs/82`](../../docs/82-اتصالِ-OpenMontage-به-فازِ-۶.md).
**چرا جداست:** تصمیمِ `D-O16` — OpenMontage پروانهٔ **AGPLv3** دارد و فلواستودیو
سرویسِ پولیِ شبکه‌ای است. این سرویس عمداً هیچ کد، شبکه یا دیتابیسی با فلواستودیو
شریک نیست؛ فقط هم‌خانه روی همان سرور. فایل‌های این پوشه **کانفیگِ عملیاتیِ ما**
هستند، نه کدِ OpenMontage.

---

## وضعیت

آخرین به‌روزرسانی: **۲۲ مرداد ۱۴۰۵**

| گام | وضعیت |
|---|---|
| کلونِ مستقل روی سرور (`/opt/backlot`، کامیت `4eab34c`، ۱۶۱MB) | ✅ انجام شد |
| بیلدِ ایمیج روی سرور | ✅ `backlot-backlot:latest` |
| کانتینر بالا و سالم | ✅ `backlot_board` — `Up (healthy)` |
| اجرای نمایشی ساخته شد | ✅ ۸ مرحله، «The Last Lighthouse» |
| اثبات از هاست | ✅ `/api/health` ⇒ `{"ok":true}` · `/p/backlot-demo-run` ⇒ ۲۰۰ |
| پورت از اینترنت بسته | ✅ فقط `172.18.0.1:4750` — از بیرون `000` |
| فایلِ رمز در `wbc_nginx` | ✅ کاربر `backlot`، هشِ `$apr1$` |
| بکاپِ `nginx.conf` | ✅ `nginx.conf.bak-backlot-1786542486` |
| رکوردِ DNS | ✅ `backlot` A `62.220.123.55` · **DNS only** (۱۴→۱۵ رکورد) |
| گواهیِ TLS | ✅ Let's Encrypt، انقضا **۲۰۲۶-۱۱-۱۰**، تمدیدِ خودکار فعال |
| بلوکِ nginx | ✅ `nginx -t` سبز، reload زده شد، ۵ همسایه ۲۰۰ |
| **🟢 زنده** | **https://backlot.flowstudio.ir** — کاربر `backlot` |

آزمونِ پذیرش (از اینترنت):

| درخواست | انتظار | واقعیت |
|---|---|---|
| بدونِ رمز | ۴۰۱ | ✅ ۴۰۱ |
| رمزِ غلط | ۴۰۱ | ✅ ۴۰۱ |
| کتابخانه با رمز | ۲۰۰ | ✅ ۲۰۰ |
| `/p/backlot-demo-run` با رمز | ۲۰۰ | ✅ ۲۰۰ |
| `robots.txt` بدونِ رمز | `Disallow: /` | ✅ |

> ⚠️ رکورد عمداً **خاکستری (DNS only)** ماند. نارنجی‌کردنش IPِ مبدأ را پنهان
> می‌کند ولی تا وقتی گواهیِ ۴۴۳ سرِ جایش است اجباری نیست. اگر نارنجی شد، اولین
> چیزی که باید چک شود همان تلهٔ ۵۲۱ است.

> 🔎 **یافتهٔ حینِ کار:** بلوکِ اولِ `listen 80` در `nginx.conf` هرچند
> `default_server` علامت نخورده، به‌طور **ضمنی** پیش‌فرضِ آن پورت است و
> `/.well-known/acme-challenge/` را از `/var/www/certbot` سرو می‌کند.
> ⇒ برای گرفتنِ گواهیِ میزبانِ تازه **لازم نیست اول بلوکِ پورتِ ۸۰ اضافه شود**؛
> به‌محضِ اینکه DNS رزولو شد، مستقیم می‌شود رفت سراغِ گامِ ۴.

---

## گامِ ۰ — رکوردِ DNS (فقط مالک)

در کلادفلر، ناحیهٔ `flowstudio.ir`:

```
Type: A    Name: backlot    Content: 62.220.123.55    Proxy: DNS only (ابرِ خاکستری)
```

> 🔴 **حتماً اول خاکستری.** اگر از همان اول پروکسی‌شده باشد و SSL روی Full،
> کلادفلر با HTTPS به مبدأ وصل می‌شود و تا گواهی روی ۴۴۳ ننشسته **۵۲۱** می‌گیری —
> در حالی که `http` سالم ۲۰۰ می‌دهد و ساعت‌ها گمراهت می‌کند.
> بعد از گرفتنِ گواهی می‌شود نارنجی‌اش کرد.

تأیید:

```bash
dig +short backlot.flowstudio.ir A     # باید 62.220.123.55 بدهد
```

## گامِ ۱ — کدِ روی سرور

```bash
ssh root@62.220.123.55
git clone --depth 1 https://github.com/calesthio/OpenMontage.git /opt/backlot
```

کلونِ **مستقل** است، نه کپیِ درختِ کاریِ مک — تلهٔ «rsync کارِ لِینِ دیگر را
می‌فرستد» این‌طور کلاً حذف می‌شود. گیت‌هاب از این سرور در دسترس است (تست شد: ۲۰۰).

## گامِ ۲ — بالا آوردنِ سرویس

```bash
cd /opt/backlot
docker compose -p backlot \
  -f /opt/flowstudio/deploy/backlot/docker-compose.backlot.yml up -d --build

# ساختِ اجرای نمایشی (یک‌بار، ~۱ دقیقه، صفر تماسِ API و صفر هزینه)
docker exec backlot_board python scripts/backlot_simulate_run.py

# اثبات از خودِ هاست، بدونِ عبور از کلادفلر
curl -s http://172.18.0.1:4750/api/health          # {"ok":true,"app":"backlot"}
curl -s -o /dev/null -w "%{http_code}\n" http://172.18.0.1:4750/p/backlot-demo-run
```

## گامِ ۳ — رمز

```bash
docker exec wbc_nginx sh -c \
  'printf "%s:%s\n" backlot "$(openssl passwd -apr1 "<رمزِ-دلخواه>")" \
   > /etc/nginx/.htpasswd-backlot'
```

> ⚠️ فایل داخلِ کانتینرِ `wbc_nginx` نوشته می‌شود و با بازساختِ آن کانتینر
> **از بین می‌رود**. اگر `wbc_nginx` recreate شد، این گام باید تکرار شود.

## گامِ ۴ — گواهی

اول بلوکِ پورتِ ۸۰ باید فعال باشد تا چالشِ acme جواب بدهد (گامِ ۵ را برای فقط
بخشِ `listen 80` انجام بده، `nginx -t`، reload، بعد این):

```bash
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt \
  -v wbc_wbc_certbot:/var/www/certbot certbot/certbot certonly \
  --webroot -w /var/www/certbot -d backlot.flowstudio.ir \
  --agree-tos -n -m postmaster@webcasting.ir
```

## گامِ ۵ — بلوکِ nginx

🔴 nginx روی این سرور **کانتینر** است (`wbc_nginx`) و کانفیگش یک فایلِ واحدِ
read-only. گذاشتنِ فایلِ جدا در `conf.d` **هیچ اثری ندارد**.

```bash
cd /opt/webcasting-platform/deploy/turkey
cp nginx.conf nginx.conf.bak-backlot-$(date +%s)      # ۱) بکاپ، بی‌چون‌وچرا
# ۲) محتوای nginx-backlot.flowstudio.ir.conf را به انتهای nginx.conf اضافه کن
docker exec wbc_nginx nginx -t                        # ۳) خطا داد؟ بکاپ را برگردان
docker exec wbc_nginx nginx -s reload                 # ۴) بدونِ این هیچ اثری ندارد
```

بعدش همسایه‌ها را چک کن — این nginx همهٔ سایت‌ها را سرو می‌کند:

```bash
for h in webcasting.ir flowstudio.ir flowstudio.webcasting.ir filmto.ir; do
  printf "%-32s " "$h"; curl -s -o /dev/null -w "%{http_code}\n" "https://$h"
done
```

## گامِ ۶ — تأییدِ نهایی

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://backlot.flowstudio.ir/   # 401
curl -s -u backlot:'<رمز>' -o /dev/null -w "%{http_code}\n" \
  https://backlot.flowstudio.ir/                                          # 200
```

**۴۰۱ بدونِ رمز، خودش بخشی از تستِ موفقیت است** — اگر بدونِ رمز ۲۰۰ داد، یعنی
`auth_basic` ننشسته و باید فوراً برگردانده شود.

---

## تله‌هایی که سرِ ساختِ همین پرونده خوردیم

1. 🔴 **`projects/` در `.gitignore`ِ بالادست است** ⇒ روی کلونِ تازه وجود ندارد و
   `COPY projects/` بیلد را می‌شکند. حالا `mkdir` می‌شود و از والیوم پر.
2. 🔴 **`python -m backlot serve` روی `127.0.0.1` هاردکد است** و `--host` ندارد
   (`backlot/__main__.py:85`) ⇒ داخلِ کانتینر از بیرون دیده نمی‌شود.
   مستقیم `uvicorn backlot.server:app --host 0.0.0.0` صدا زده می‌شود.
3. 🔴 **شبیه‌ساز باگ دارد** — از `research` به `script` می‌پرد و `proposal` را جا
   می‌اندازد ⇒ `PREREQUISITE VIOLATION`. وصله‌اش حینِ بیلد می‌نشیند و اگر لنگرش
   پیدا نشود بیلد **بلند** می‌شکند.
4. 🔴 **زنجیرهٔ وابستگیِ پنهانِ شبیه‌ساز:** `styles/` (وگرنه
   «Available playbooks: []»)، بعد `pytest`، بعد `tools/`. هیچ‌کدام برای *سرو‌کردنِ*
   برد لازم نیستند، فقط برای *ساختنِ* دمو.
5. 🔴 **UIِ برد مسیرِ مطلق می‌زند** (`/api/project/…`) و `root_path` ندارد ⇒
   زیرمسیر (`flowstudio.ir/backlot`) **کار نمی‌کند** و با `/api/`ِ خودِ فلواستودیو
   تصادم می‌کند. میزبانِ جدا اجباری است، نه سلیقه‌ای.
6. 🔴 **برد با SSE زنده می‌ماند** ⇒ بدونِ `proxy_buffering off` روی
   `/api/*/events` برد بی‌هیچ خطایی یخ می‌زند. بلوک این را دارد.

## برچیدن

```bash
docker compose -p backlot -f /opt/flowstudio/deploy/backlot/docker-compose.backlot.yml down
# سپس بلوک را از nginx.conf بردار، nginx -t، reload، و رکوردِ DNS را پاک کن.
```
