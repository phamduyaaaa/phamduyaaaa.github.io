# Ghi chú bàn giao — Blog + CSS architecture

## Cập nhật quan trọng: đường dẫn tuyệt đối → tương đối

Sau lần giao đầu tiên, `index.html` khi mở trực tiếp (double-click,
`file://...`) bị mất toàn bộ style. Nguyên nhân: tôi dùng
`<link href="/styles/main.css">` — dấu `/` ở đầu nghĩa là "gốc ổ đĩa", chỉ đúng
khi chạy qua server thật (localhost hoặc GitHub Pages), không đúng khi mở
file trực tiếp bằng trình duyệt.

Đã sửa toàn bộ sang đường dẫn tương đối:
- `index.html` → `styles/main.css`, `favicon.svg`, `mission/`
- `blog/index.html` → `../styles/main.css`, `styles/blog.css`, `js/i18n.js`, `posts.json`
- `blog/posts/*.html` (qua `scripts/build-blog.py`) → `../../styles/main.css`,
  `../styles/blog.css`, `../js/i18n.js`

Đường dẫn tương đối hoạt động đúng ở **cả hai** trường hợp: mở trực tiếp
bằng `file://` và chạy qua server thật / GitHub Pages — nên không cần đổi
gì thêm khi deploy.

**Giới hạn cần biết:** `blog/index.html` dùng `fetch('posts.json')` để tải
danh sách bài viết. Trình duyệt chặn `fetch()` với file cục bộ vì lý do
bảo mật (CORS), nên nếu bạn **double-click mở trực tiếp** `blog/index.html`,
danh sách bài viết sẽ không tải được (hiện thông báo lỗi thân thiện thay vì
trắng trang). Đây là giới hạn của trình duyệt, không sửa được bằng path.
Cách test đúng cho trang blog: chạy `python3 -m http.server` trong thư mục
gốc rồi mở `http://localhost:8000/blog/`, hoặc xem trực tiếp trên GitHub
Pages sau khi deploy — cả hai trường hợp đều hoạt động bình thường.

## Kiến trúc CSS: entry point và các module

Trước đây `index.html` có một khối `<style>...</style>` inline (618 dòng,
chứa toàn bộ design tokens: màu, font, spacing, nav, hero, cards...), và
`style.css` đứng riêng, chưa từng được `<link>` vào `index.html` — nghĩa là
các thay đổi "2026 upgrade" (bo góc lớn hơn, shadow mịn hơn, nút dạng pill)
trong `style.css` **chưa hề có hiệu lực** trên trang thật. Hiện tại stylesheet
đã được tách và nạp qua `styles/main.css`.

Đã xử lý:
- Tách CSS thành các module trong `styles/base`, `styles/components`,
  `styles/effects` và `styles/layout`, với `styles/main.css` làm entry point.
- `index.html` giờ chỉ còn `<link rel="stylesheet" href="styles/main.css">`,
  không còn CSS inline.
- `blog/index.html` và mọi trang bài viết trong `blog/posts/*.html` cũng
  `<link>` tới **đúng file `styles/main.css` này** (qua đường dẫn tương đối).

**Từ giờ:** sửa màu / font / spacing / component trong `styles/` sẽ tự
động áp dụng cho cả trang chủ lẫn toàn bộ blog. Không cần sửa 2 nơi.

`blog/styles/blog.css` chỉ chứa phần bổ sung riêng cho ngữ cảnh đọc blog
(post-card, post-body, code block, language toggle...) — không định nghĩa
lại bất kỳ token hay selector nào đã có trong `styles/` (đã kiểm tra
không trùng tên class).

## Quy trình viết bài mới

1. Copy `blog/posts/_template.md` thành `blog/posts/<slug-khong-dau>.md`
2. Điền frontmatter: `slug`, `date`, `title_en`, `title_vi`, `excerpt_en`,
   `excerpt_vi`, `tags`
3. Viết nội dung trong 2 khối `:::en ... :::` và `:::vi ... :::`
4. Chạy:
   ```bash
   pip install markdown pyyaml --break-system-packages   # chỉ cần 1 lần
   python3 scripts/build-blog.py
   ```
5. Script tự tạo `blog/posts/<slug>.html` và cập nhật `blog/posts.json`.
   Không cần sửa `blog/index.html` — nó tự đọc `posts.json`.

## Đã kiểm tra
- HTML tag-balance (div/section/nav/html/body...) trên `index.html`,
  `blog/index.html`, `blog/posts/*.html`.
- Kiểm tra các module CSS và đường dẫn stylesheet sau khi tách.
- Không có selector trùng tên giữa `styles/` và `blog/styles/blog.css`.
- Toggle EN/VI dùng `data-en` / `data-vi`, CSS khai báo display tường minh
  theo từng loại thẻ (div/p/h1/h2/h3/li/blockquote/span/a/strong/em).
- Mobile nav (hamburger menu) đã thêm vào các trang blog.
- Mô phỏng resolve đường dẫn tương đối cho từng file HTML → từng asset,
  xác nhận tất cả trỏ đúng vị trí thực tế trên đĩa.

## JavaScript architecture
- `js/app.js` khởi tạo các module boot screen, navigation, cursor, RL engine,
  GSAP ScrollTrigger reveals, hero entrance, card tilt và magnetic navigation.
- Các phần tử cuộn dùng `data-reveal`/`data-stagger`; GSAP là nguồn điều khiển
  opacity và transform, không còn IntersectionObserver cũ.

## Chưa kiểm tra được trong môi trường này
- Không có headless browser trong sandbox để chụp ảnh render thật —
  đã bù bằng cách rà tay CSS cascade, tag-balance, brace-balance, và
  mô phỏng path resolution. Bạn nên tự mở bằng browser thật để xác nhận
  trực quan trước khi deploy lên GitHub Pages.
