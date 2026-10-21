"""Sinh bản tiếng Việt của sơ đồ: learnvla/diagrams/<name>.vi.svg từ <name>.svg và bảng dịch scripts/data/svg-vi.json.
Chạy lại sau khi sửa một sơ đồ gốc hoặc chạy gen-survey-figs.py:  python scripts/translate-svgs.py
build-blog.py tự dùng bản .vi.svg trong khối :::vi nếu có."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIAG = ROOT / "learnvla/diagrams"
table = json.loads((ROOT / "scripts/data/svg-vi.json").read_text(encoding="utf-8"))
TEXT_RE = re.compile(r"(<(?:text|tspan)\b[^>]*>)([^<]+)(<)")

missing = 0
for name, tr in table.items():
    src = DIAG / name
    svg = src.read_text(encoding="utf-8")
    used = set()

    def sub(m):
        t = m.group(2).strip()
        if t in tr:
            used.add(t)
            return m.group(1) + m.group(2).replace(t, tr[t]) + m.group(3)
        return m.group(0)

    out = TEXT_RE.sub(sub, svg)
    for k in tr.keys() - used:
        print(f"{name}: không còn nhãn '{k}' trong sơ đồ gốc", file=sys.stderr)
        missing += 1
    src.with_name(src.stem + ".vi.svg").write_text(out, encoding="utf-8")
print(len(table), "sơ đồ;", missing, "nhãn thừa")
