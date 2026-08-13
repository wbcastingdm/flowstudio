# ─── Backlot — بردِ زندهٔ OpenMontage، سرویسِ کاملاً جدا ───
#
# ⚠️ این ایمیج کدِ **OpenMontage** را اجرا می‌کند که پروانه‌اش AGPLv3 است.
#    طبقِ تصمیمِ D-O16 این سرویس عمداً از فلواستودیو **جدا** است:
#    نه شبکهٔ مشترک، نه دیتابیسِ مشترک، نه یک خط کدِ مشترک.
#    فقط برایِ تماشای این‌که موتور چطور کار می‌کند.
#    کدِ کاملش عمومی است: https://github.com/calesthio/OpenMontage
#
# کانتکستِ بیلد روی سرور: /opt/backlot  (کلونِ مستقلِ OpenMontage)

FROM python:3.11-slim

WORKDIR /srv/backlot

# backlot فقط زیرمجموعه‌ای از وابستگی‌ها را لازم دارد — نه کلِ requirements.txt.
# (بدونِ google-genai و openai که ۱۰۰MB+ اضافه می‌کنند و برای بردِ خواندنی بی‌مصرف‌اند.)
RUN pip install --no-cache-dir \
      "fastapi>=0.110" \
      "uvicorn>=0.29" \
      "watchfiles>=0.21" \
      "pyyaml>=6.0" \
      "pydantic>=2.0" \
      "jsonschema>=4.20" \
      "python-dotenv>=1.0" \
      "Pillow>=10.0" \
      "requests>=2.31" \
      "pytest>=8.0"
# 🔴 `pytest` وابستگیِ *اجرا* نیست، ولی شبیه‌سازِ نمایشی فیکسچرِ
#    `sample_artifact` را از `tests/contracts/test_phase0_contracts.py` می‌گیرد
#    و آن ماژول در سطحِ بالا `import pytest` دارد. بدونش ساختِ دمو می‌افتد.

COPY backlot/ ./backlot/
COPY lib/ ./lib/
COPY pipeline_defs/ ./pipeline_defs/
COPY schemas/ ./schemas/
# 🔴 `styles/` لازم است وگرنه `init_project` با
#    «Unknown style_playbook … Available playbooks: []» می‌افتد.
COPY styles/ ./styles/

# `scripts/` و `tests/` فقط برای ساختنِ اجرای نمایشی لازم‌اند
# (شبیه‌ساز از `tests.contracts…` فیکسچرِ معتبرِ اسکیمایی می‌گیرد).
COPY scripts/ ./scripts/
COPY tests/ ./tests/
# `tools/base_tool` را ماژولِ تست وارد می‌کند. خودش فقط کتابخانهٔ استاندارد
# می‌خواهد، پس هیچ وابستگیِ سنگینی نمی‌آورد.
COPY tools/ ./tools/

# 🔴 `projects/` در `.gitignore`ِ بالادست است ⇒ روی کلونِ تازهٔ سرور **وجود ندارد**.
#    `COPY projects/` بیلد را می‌شکند. ساختنش این‌جا، پرشدنش از والیوم.
RUN mkdir -p projects

# 🔴 وصلهٔ باگِ بالادست در شبیه‌ساز: از `research` مستقیم به `script` می‌پرد،
#    ولی ترتیبِ مراحل `research → proposal → script → …` است و
#    `_enforce_stage_prerequisites` با «PREREQUISITE VIOLATION» متوقفش می‌کند.
#    فیکسچرِ `proposal_packet` از قبل در تست‌های قرارداد هست، فقط صدا زده نمی‌شد.
#    ⚠️ سورس در مخزن دست‌نخورده می‌ماند؛ وصله فقط حینِ بیلد می‌نشیند تا مرزِ
#    D-O16 روشن بماند. اگر لنگر پیدا نشود بیلد **بلند** می‌شکند، نه بی‌صدا.
RUN python - <<'PY'
from pathlib import Path
p = Path("scripts/backlot_simulate_run.py")
src = p.read_text(encoding="utf-8")
anchor = '    # script gates: awaiting_human -> approved'
if 'cp("proposal"' in src:
    print("[patch] already present — skipping")
else:
    assert anchor in src, "ANCHOR NOT FOUND — upstream simulator changed; re-check the patch"
    src = src.replace(anchor,
        '    # proposal is a prerequisite of script in every pipeline stage order\n'
        '    cp("proposal", "in_progress", {})\n'
        '    cp("proposal", "completed",\n'
        '       {"proposal_packet": sample_artifact("proposal_packet")},\n'
        '       human_approved=True)\n\n' + anchor, 1)
    p.write_text(src, encoding="utf-8")
    print("[patch] proposal stage inserted")
PY

ENV PYTHONUNBUFFERED=1 \
    BACKLOT_PORT=4750

EXPOSE 4750

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:4750/api/health',timeout=4)"

# 🔴 `python -m backlot serve` روی `127.0.0.1` هاردکد است (`backlot/__main__.py:85`)
#    و `--host` ندارد ⇒ داخلِ کانتینر از بیرون دیده نمی‌شود.
#    مستقیم uvicorn را صدا می‌زنیم تا لازم نباشد کدِ AGPL وصله بخورد.
CMD ["uvicorn", "backlot.server:app", "--host", "0.0.0.0", "--port", "4750", "--log-level", "warning"]
