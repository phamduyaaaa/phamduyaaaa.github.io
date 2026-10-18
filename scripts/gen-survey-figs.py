"""Sinh sơ đồ ma trận cho Survey 1 và khối tài liệu tham khảo (một lần, dữ liệu ở scripts/data/force-refs.tsv).
Chạy:  python scripts/gen-survey-figs.py
Ghi:   learnvla/diagrams/survey-force-matrix.svg  và  scripts/data/force-refs.md (khối tham khảo để dán vào bài)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
rows = [l.rstrip("\n").split("\t") for l in (ROOT / "scripts/data/force-refs.tsv").read_text(encoding="utf-8").splitlines() if l.strip()]
meth = sorted([r for r in rows if not r[1].startswith("Survey")], key=lambda r: r[3])
surv = [r for r in rows if r[1].startswith("Survey")]

ENTRY = {
 "VTLA": "1", "ForceVLA": "2", "Tactile-VLA": "14", "VLA-Touch": "14", "VLH": "", "OmniVTLA": "1", "TA-VLA": "36",
 "CompliantVLA-adaptor": "4", "TaF-VLA": "35", "FD-VLA": "15", "CRAFT": "5", "FAVLA": "3", "TER-DAgger": "46",
 "MoDE-VLA": "2", "ForceVLA2": "12", "HapticVLA": "5", "Tabero": "14", "TORL-VLA": "26", "DAM-VLA": "3",
 "UniTacVLA": "46", "H-Tac": "56", "LIFT": "3", "FM-VLA": "3", "ForceU-VLA": "2", "FWBC-VLA": "34", "TacPAC": "46",
 "CR-VLA-Force": "24", "DeCAL": "26", "ForceDelta-VLA": "4", "ForceRFT": "4", "CompVLA": "4", "Opt2VLA": "4", "DexTacWAM": "6",
}
FULL = {"ForceVLA", "VLA-Touch", "ForceVLA2", "MoDE-VLA", "TaF-VLA", "Tabero", "FD-VLA", "HapticVLA", "FWBC-VLA", "TORL-VLA", "TER-DAgger"}
HEAD = ["① VLM input", "② After VLM", "③ Action expert", "④ Outside VLA", "⑤ Training only", "⑥ Predicted"]

def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;")

x0, dx, top, rh = 330, 100, 84, 22
H = top + rh * len(meth) + 36
out = [f'<svg viewBox="0 0 980 {H}" xmlns="http://www.w3.org/2000/svg">']
for j, h in enumerate(HEAD):
    cx = x0 + j * dx
    out.append(f'<text class="dg-t" x="{cx}" y="40" text-anchor="middle">{esc(h.split(" ", 1)[0])}</text>')
    out.append(f'<text class="dg-s" x="{cx}" y="58" text-anchor="middle">{esc(h.split(" ", 1)[1])}</text>')
    out.append(f'<path class="dg-grp" d="M{cx} {top - 8} V{top + rh * len(meth)}"/>')
for i, r in enumerate(meth):
    y = top + i * rh
    if i % 2 == 0:
        out.append(f'<rect x="10" y="{y - 4}" width="960" height="{rh}" fill="currentColor" fill-opacity=".05"/>')
    full = r[1] in FULL
    out.append(f'<text class="dg-s" x="24" y="{y + 11}">{i + 1:>2}</text>')
    out.append(f'<text class="{"dg-t" if full else "dg-s"}" x="54" y="{y + 11}">{esc(r[1])}</text>')
    out.append(f'<text class="dg-mute dg-s" x="250" y="{y + 11}">{r[3][:7]}</text>')
    for ch in ENTRY[r[1]]:
        j = int(ch) - 1
        cx = x0 + j * dx
        out.append(f'<circle cx="{cx}" cy="{y + 7}" r="6.5" class="{"dg-key" if full else "dg-box"}"/>')
    if not ENTRY[r[1]]:
        out.append(f'<text class="dg-s dg-mute" x="{x0}" y="{y + 11}">no sensor input: haptics is an output</text>')
yb = top + rh * len(meth) + 22
out.append(f'<circle cx="30" cy="{yb}" r="6.5" class="dg-key"/><text class="dg-s" x="44" y="{yb + 4}">bold name: full note on this site</text>')
out.append(f'<circle cx="320" cy="{yb}" r="6.5" class="dg-box"/><text class="dg-s" x="334" y="{yb + 4}">plain name: classified from the abstract</text>')
out.append("</svg>")
(ROOT / "learnvla/diagrams/survey-force-matrix.svg").write_text("\n".join(out), encoding="utf-8")

lines = []
for i, r in enumerate(meth, 1):
    lines.append(f"{i}. {r[2]}. [arXiv:{r[0]}](https://arxiv.org/abs/{r[0]}), {r[3]}.")
lines.append("")
lines.append("Broader surveys:")
lines.append("")
for r in surv:
    lines.append(f"- {r[2]}. [arXiv:{r[0]}](https://arxiv.org/abs/{r[0]}), {r[3]}.")
(ROOT / "scripts/data/force-refs.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(len(meth), "methods;", H, "px tall")
