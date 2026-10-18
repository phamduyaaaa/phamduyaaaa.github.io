#!/usr/bin/env python3
"""
build-blog.py
=============
Quét <section>/posts/*.md, build ra:
  - <section>/posts/<slug>.html (1 file HTML mỗi bài, song ngữ EN/VI)
  - <section>/posts.json        (manifest cho trang section đọc để render danh sách)

Cách dùng:
    python3 scripts/build-blog.py                  # build blog (mặc định)
    python3 scripts/build-blog.py --section learnvla

Yêu cầu mỗi file .md có frontmatter dạng:
    ---
    slug: ten-khong-dau
    date: 2026-07-25
    title_en: ...
    title_vi: ...
    excerpt_en: ...
    excerpt_vi: ...
    tags: [A, B, C]
    ---
Và nội dung được bọc trong khối :::en ... ::: và :::vi ... :::
(xem blog/posts/_template.md để có ví dụ đầy đủ)

File bắt đầu bằng "_" (như _template.md) sẽ bị bỏ qua khi build.
"""
import json
import re
import sys
import argparse
from pathlib import Path
from datetime import datetime

import markdown
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?\n)---\s*\n(.*)$", re.DOTALL)
LANG_BLOCK_RE = re.compile(r":::(en|vi)\s*\n(.*?)\n:::", re.DOTALL)

# md_in_html: cho phép viết markdown bên trong <div class="tldr" markdown="1"> ... </div>
MD_EXTENSIONS = ["fenced_code", "tables", "sane_lists", "md_in_html"]


MATH_BLOCK_RE = re.compile(r"\$\$.+?\$\$", re.DOTALL)
MATH_INLINE_RE = re.compile(r"(?<![\\$])\$(?!\s)[^$\n]+?(?<!\s)\$")


FIG_RE = re.compile(r"^\[\[fig:([\w-]+)\]\][ \t]*(.*)$", re.MULTILINE)


def render_figure(name: str, caption: str, diagram_dir: Path) -> str:
    """Nhúng diagrams/<name>.svg thành <figure> có caption (dùng chung cho cả EN và VI)."""
    svg_path = diagram_dir / f"{name}.svg"
    if not svg_path.exists():
        raise ValueError(f"không tìm thấy sơ đồ {svg_path}")
    svg = svg_path.read_text(encoding="utf-8").strip()
    label = caption.replace("&", "&amp;").replace('"', "&quot;")
    svg = svg.replace("<svg ", f'<svg role="img" aria-label="{label}" ', 1)
    return f'<figure class="diagram">{svg}<figcaption>{caption}</figcaption></figure>'


# ---------------------------------------------------------------------------
# Hình tự sinh khi build (không cần vẽ tay):
#
#   [[flow]]
#   - Before · ForceVLA | Wrist F/T > VLM + MoE > !Pose only! | cannot ask for 10 N
#   + ForceVLA2 | F/T + prompt > VLM + MoE > *Pose + force* | controller holds the force
#   [[/flow]] Caption
#     "-" = hàng "trước" (ghi chú đỏ ✗), "+" = hàng "paper này" (ghi chú xanh ✓), "=" = trung tính.
#     Các ô ngăn bởi " > ". *ô* = tô vàng (điểm mới), !ô! = tô đỏ (điểm hỏng), "~" = xuống dòng.
#
#   [[bars:%]] π0-base=37.3; *ForceVLA=60.5* || Caption
#     Đơn vị "%" (thang 100), "/30" (thang 30), hoặc "N:20" (đơn vị N, thang 20). *nhãn=giá trị* = cột nổi bật.
# ---------------------------------------------------------------------------
FLOW_RE = re.compile(r"^\[\[flow\]\][ \t]*\n(.*?)\n\[\[/flow\]\][ \t]*([^\n]*)$", re.MULTILINE | re.DOTALL)
BARS_RE = re.compile(r"^\[\[bars:([^\]]*)\]\][ \t]*(.*?)(?:[ \t]*\|\|[ \t]*(.*))?$", re.MULTILINE)

CH_T, CH_S, CH_N = 7.6, 6.4, 6.9  # bề rộng ước lượng một ký tự (px) của dg-t, dg-s, ghi chú


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _figure(svg: str, caption: str, extra_class: str = "") -> str:
    label = caption.replace("&", "&amp;").replace('"', "&quot;")
    svg = svg.replace("<svg ", f'<svg role="img" aria-label="{label}" ', 1)
    cls = f"diagram {extra_class}".strip()
    return f'<figure class="{cls}">{svg}<figcaption>{caption}</figcaption></figure>'


def render_flow(body: str, caption: str) -> str:
    rows = []
    for raw in body.strip().splitlines():
        line = raw.strip()
        if not line:
            continue
        kind = line[0] if line[0] in "-+=" else "="
        if line[0] in "-+=":
            line = line[1:].strip()
        parts = [p.strip() for p in line.split("|")]
        boxes = []
        for b in re.split(r"\s+>\s+", parts[1]) if len(parts) > 1 else []:
            style = "box"
            if len(b) > 1 and b[0] == b[-1] == "*":
                style, b = "key", b[1:-1]
            elif len(b) > 1 and b[0] == b[-1] == "!":
                style, b = "bad", b[1:-1]
            lines = [t.strip() for t in b.split("~")]
            w = max(96, max([len(lines[0]) * CH_T] + [len(t) * CH_S for t in lines[1:]]) + 26)
            h = 22 + 16 * len(lines)
            boxes.append((style, lines, w, h))
        rows.append((kind, [t.strip() for t in parts[0].split("~")], boxes, parts[2] if len(parts) > 2 else ""))

    label_w = max(110, max(len(t) * CH_S for r in rows for t in r[1]) + 24)
    gap, pad, out, y, width = 34, 14, [], 14, 0
    for kind, label, boxes, note in rows:
        color = {"-": "dg-red", "+": "dg-green", "=": "dg-mute"}[kind]
        row_h = max([b[3] for b in boxes] + [40])
        for i, t in enumerate(label):
            out.append(f'<text class="dg-lab {color}" x="{pad}" y="{y + row_h / 2 - 6 * (len(label) - 1) + 14 * i + 4:.0f}">{_esc(t)}</text>')
        x = pad + label_w
        for j, (style, lines, w, h) in enumerate(boxes):
            by = y + (row_h - h) / 2
            cls = {"box": "dg-box", "key": "dg-key", "bad": "dg-badbox"}[style]
            out.append(f'<rect class="{cls}" x="{x:.0f}" y="{by:.0f}" width="{w:.0f}" height="{h:.0f}"/>')
            for i, t in enumerate(lines):
                tcls = "dg-t" if i == 0 else "dg-s"
                ty = by + h / 2 - 8 * (len(lines) - 1) + 16 * i + 4
                out.append(f'<text class="{tcls}" x="{x + w / 2:.0f}" y="{ty:.0f}" text-anchor="middle">{_esc(t)}</text>')
            if j < len(boxes) - 1:
                ay = y + row_h / 2
                out.append(f'<path class="dg-a" d="M{x + w:.0f} {ay:.0f} H{x + w + gap - 2:.0f}"/>')
            x += w + (gap if j < len(boxes) - 1 else 0)
        width = max(width, x + pad)
        y += row_h
        if note:
            mark = {"-": "✗ ", "+": "✓ ", "=": ""}[kind]
            out.append(f'<text class="dg-note {color}" x="{pad + label_w}" y="{y + 18}">{_esc(mark + note)}</text>')
            width = max(width, pad + label_w + len(mark + note) * CH_N + pad)
            y += 26
        y += 18
    height = y - 4
    svg = (f'<svg class="dg-natural" width="{width:.0f}" height="{height:.0f}" '
           f'viewBox="0 0 {width:.0f} {height:.0f}" xmlns="http://www.w3.org/2000/svg">' + "".join(out) + "</svg>")
    return _figure(svg, caption, "flow")


def render_bars(spec: str, data: str, caption: str, lang: str) -> str:
    unit, _, mx = spec.partition(":")
    items = []
    for chunk in data.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        key = len(chunk) > 1 and chunk[0] == chunk[-1] == "*"
        label, _, val = chunk.strip("*").rpartition("=")
        items.append((label.strip(), float(val), key))
    if mx:
        top = float(mx)
    elif unit == "%":
        top = 100.0
    elif unit.startswith("/"):
        top = float(unit[1:])
    else:
        top = max(v for _, v, _ in items) * 1.15

    def fmt(v):
        s = f"{v:g}"
        if lang == "vi":
            s = s.replace(".", ",")
        if unit == "%":
            return s + "%"
        if unit.startswith("/"):
            return s + unit
        return f"{s} {unit}".strip()

    label_w = max(len(l) for l, _, _ in items) * CH_N + 18
    bar_w, row_h = 360, 30
    width = label_w + bar_w + 90
    out = []
    for i, (label, v, key) in enumerate(items):
        y = 8 + i * row_h
        bw = max(2, v / top * bar_w)
        out.append(f'<text class="dg-barlabel" x="{label_w - 10:.0f}" y="{y + 15}" text-anchor="end">{_esc(label)}</text>')
        out.append(f'<rect class="{"dg-key" if key else "dg-bar"}" x="{label_w:.0f}" y="{y + 2}" width="{bw:.0f}" height="18"/>')
        out.append(f'<text class="dg-barval" x="{label_w + bw + 8:.0f}" y="{y + 15}">{_esc(fmt(v))}</text>')
    height = 8 + len(items) * row_h + 4
    svg = (f'<svg class="dg-natural" width="{width:.0f}" height="{height}" '
           f'viewBox="0 0 {width:.0f} {height}" xmlns="http://www.w3.org/2000/svg">' + "".join(out) + "</svg>")
    return _figure(svg, caption or "", "compact")


def render_markdown(text: str, diagram_dir: Path = None, lang: str = "en") -> str:
    """Markdown -> HTML, giữ nguyên công thức $...$ / $$...$$ (KaTeX), nhúng sơ đồ [[fig:name]]
    và các hình tự sinh [[flow]] ... [[/flow]], [[bars:...]]."""
    store = []

    def stash(m):
        store.append(m.group(0))
        return f"@@MATH{len(store) - 1}@@"

    figs = []

    def stash_fig(m):
        figs.append(render_figure(m.group(1), m.group(2).strip(), diagram_dir))
        return f"@@FIG{len(figs) - 1}@@"

    def stash_flow(m):
        figs.append(render_flow(m.group(1), m.group(2).strip()))
        return f"@@FIG{len(figs) - 1}@@"

    def stash_bars(m):
        figs.append(render_bars(m.group(1), m.group(2), (m.group(3) or "").strip(), lang))
        return f"@@FIG{len(figs) - 1}@@"

    text = FLOW_RE.sub(stash_flow, text)
    text = BARS_RE.sub(stash_bars, text)
    text = FIG_RE.sub(stash_fig, text)
    text = MATH_BLOCK_RE.sub(stash, text)
    text = MATH_INLINE_RE.sub(stash, text)
    html = markdown.markdown(text, extensions=MD_EXTENSIONS)
    for i, math in enumerate(store):
        safe = math.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        html = html.replace(f"@@MATH{i}@@", safe)
    for i, fig in enumerate(figs):
        html = html.replace(f"<p>@@FIG{i}@@</p>", fig).replace(f"@@FIG{i}@@", fig)
    return html


def parse_post(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(raw)
    if not m:
        raise ValueError(f"{path.name}: thiếu frontmatter (phải bắt đầu bằng '---')")

    meta = yaml.safe_load(m.group(1)) or {}
    body = m.group(2)

    required = ["slug", "date", "title_en", "title_vi", "excerpt_en", "excerpt_vi"]
    missing = [k for k in required if not meta.get(k)]
    if missing:
        raise ValueError(f"{path.name}: thiếu trường frontmatter: {', '.join(missing)}")

    blocks = {"en": "", "vi": ""}
    for lang, content in LANG_BLOCK_RE.findall(body):
        blocks[lang] += content.strip() + "\n\n"

    if not blocks["en"].strip() or not blocks["vi"].strip():
        raise ValueError(f"{path.name}: cần có cả khối :::en::: và :::vi:::")

    diagram_dir = path.parent.parent / "diagrams"
    html_en = render_markdown(blocks["en"].strip(), diagram_dir, "en")
    html_vi = render_markdown(blocks["vi"].strip(), diagram_dir, "vi")

    tags = meta.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]

    date_str = str(meta["date"])
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise ValueError(f"{path.name}: date phải theo định dạng YYYY-MM-DD")

    words_en = len(re.sub(r"<[^>]+>", " ", html_en).split())
    read_min = max(1, round(words_en / 200))

    return {
        "slug": meta["slug"],
        "date": date_str,
        "date_display": date_obj.strftime("%d %b %Y"),
        "title_en": meta["title_en"],
        "title_vi": meta["title_vi"],
        "excerpt_en": meta["excerpt_en"],
        "excerpt_vi": meta["excerpt_vi"],
        "tags": tags,
        "read_min": read_min,
        "html_en": html_en,
        "html_vi": html_vi,
    }


def render_post_html(post: dict, section: str) -> str:
    tags_html = "".join(f'<span class="pill">{t}</span>' for t in post["tags"])
    section_title = "Learn VLA" if section == "learnvla" else "Blog"
    section_styles = "../../blog/styles/blog.css" if section == "learnvla" else "../styles/blog.css"
    extras_styles = "../../blog/styles/article-extras.css?v=2" if section == "learnvla" else "../styles/article-extras.css?v=2"
    section_i18n = "../../blog/js/i18n.js" if section == "learnvla" else "../js/i18n.js"
    blog_url = "../../blog/" if section == "learnvla" else "../"
    learnvla_url = "../" if section == "learnvla" else "../../learnvla/"
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="{post['excerpt_en']}">
<title>{post['title_en']} · {section_title} · Phạm Đức Duy</title>

<link rel="icon" type="image/svg+xml" href="../../favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@400;500;600&family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">

<meta property="og:title" content="{post['title_en']}">
<meta property="og:description" content="{post['excerpt_en']}">
<meta property="og:type" content="article">

<link rel="stylesheet" href="../../styles/main.css?v=vi-type">
<link rel="stylesheet" href="{section_styles}">
<link rel="stylesheet" href="{extras_styles}">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"
  onload="renderMathInElement(document.querySelector('.post-body'), {{delimiters: [{{left: '$$', right: '$$', display: true}}, {{left: '$', right: '$', display: false}}], throwOnError: false}});"></script>
</head>
<body>

<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-m" d="M0 0 L10 5 L0 10 z"/></marker></defs></svg>
<div class="mobile-backdrop" id="mobileBackdrop" onclick="toggleMenu(false)"></div>
<div class="mobile-menu" id="mobileMenu" role="navigation" aria-label="Mobile navigation">
  <a href="{blog_url}" onclick="toggleMenu(false)">Blog</a>
  <a href="{learnvla_url}" onclick="toggleMenu(false)">Learn VLA</a>
  <a href="../../#projects" onclick="toggleMenu(false)">Projects</a>
  <a href="../../#contact" onclick="toggleMenu(false)">Contact</a>
</div>

<nav>
  <div class="nav-inner">
    <a href="../../" class="nav-logo" aria-label="Về trang chủ"><span class="nav-dot"></span>Phạm Đức Duy</a>
    <ul class="nav-links" role="navigation" aria-label="Main navigation">
      <li><a href="{blog_url}">Blog</a></li>
      <li><a href="{learnvla_url}">Learn VLA</a></li>
      <li><a href="../../#projects">Projects</a></li>
      <li><a href="../../#contact">Contact</a></li>
    </ul>
    <div class="lang-toggle" role="group" aria-label="Language switch">
      <button class="lang-btn" data-lang="en" aria-pressed="false">EN</button>
      <button class="lang-btn" data-lang="vi" aria-pressed="false">VI</button>
    </div>
    <button class="nav-mobile-btn" id="hamburgerBtn" aria-label="Toggle navigation menu" aria-expanded="false" onclick="toggleMenu()">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<div class="container">
  <header class="post-header">
    <a href="../" class="post-back">← <span data-en>Back to all posts</span><span data-vi>Về danh sách bài viết</span></a>

    <div class="post-meta-row">
      <span class="post-meta-date">{post['date_display']}</span>
      <span class="post-meta-sep">·</span>
      <span class="post-meta-read">{post['read_min']} <span data-en>min read</span><span data-vi>phút đọc</span></span>
    </div>

    <h1 data-en>{post['title_en']}</h1>
    <h1 data-vi>{post['title_vi']}</h1>

    <p class="post-excerpt-lead" data-en>{post['excerpt_en']}</p>
    <p class="post-excerpt-lead" data-vi>{post['excerpt_vi']}</p>

    <div class="post-tags-row">{tags_html}</div>
  </header>

  <article class="post-body">
    <div data-en>
{post['html_en']}
    </div>
    <div data-vi>
{post['html_vi']}
    </div>
  </article>

  <div class="post-footer">
    <a href="../" class="btn btn-ghost">← <span data-en>All posts</span><span data-vi>Tất cả bài viết</span></a>
    <a href="mailto:duypham.robotics@gmail.com" class="btn btn-amber"><span data-en>Get in touch</span><span data-vi>Liên hệ</span> ↗</a>
  </div>

  <footer style="margin-top: var(--sp-16);">
    <div class="footer-inner">
      <div class="footer-copy">© <span id="footerYear"></span> Phạm Đức Duy</div>
      <div class="footer-built"><span data-en>Built with</span><span data-vi>Xây dựng bằng</span> <span>HTML + Vanilla JS</span> · <span data-en>No frameworks.</span><span data-vi>Không framework.</span></div>
    </div>
  </footer>
</div>

<script>document.getElementById('footerYear').textContent = new Date().getFullYear();</script>
<script src="{section_i18n}"></script>
<script>
function toggleMenu(force) {{
  var menu = document.getElementById('mobileMenu');
  var backdrop = document.getElementById('mobileBackdrop');
  var hamBtn = document.getElementById('hamburgerBtn');
  var isOpen = typeof force === 'boolean' ? force : !menu.classList.contains('open');
  menu.classList.toggle('open', isOpen);
  backdrop.classList.toggle('open', isOpen);
  hamBtn.classList.toggle('open', isOpen);
  hamBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}}
</script>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description="Build a Markdown article section.")
    parser.add_argument("--section", choices=("blog", "learnvla"), default="blog")
    section = parser.parse_args().section
    section_dir = REPO_ROOT / section
    posts_dir = section_dir / "posts"
    manifest_path = section_dir / "posts.json"

    if not posts_dir.exists():
        print(f"Không tìm thấy thư mục {posts_dir}", file=sys.stderr)
        sys.exit(1)

    md_files = sorted(p for p in posts_dir.glob("*.md") if not p.name.startswith("_"))
    if not md_files:
        print("Không có file .md nào để build (bỏ qua các file bắt đầu bằng '_').")

    posts = []
    errors = []
    for path in md_files:
        try:
            post = parse_post(path)
            posts.append(post)
            html = render_post_html(post, section)
            out_path = posts_dir / f"{post['slug']}.html"
            out_path.write_text(html, encoding="utf-8")
            print(f"  ✓ {path.name} → {section}/posts/{post['slug']}.html")
        except ValueError as e:
            errors.append(str(e))
            print(f"  ✗ {e}", file=sys.stderr)

    # Sắp xếp mới nhất trước
    posts.sort(key=lambda p: p["date"], reverse=True)

    manifest = [
        {
            "slug": p["slug"],
            "date": p["date"],
            "date_display": p["date_display"],
            "title_en": p["title_en"],
            "title_vi": p["title_vi"],
            "excerpt_en": p["excerpt_en"],
            "excerpt_vi": p["excerpt_vi"],
            "tags": p["tags"],
            "read_min": p["read_min"],
        }
        for p in posts
    ]
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n  → {section}/posts.json ({len(posts)} bài viết)")

    if errors:
        print(f"\n{len(errors)} file lỗi, xem chi tiết ở trên.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
