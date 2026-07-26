---
slug: ten-bai-viet-khong-dau-cach
date: 2026-07-25
title_en: Your Post Title in English
title_vi: Tiêu đề bài viết bằng tiếng Việt
excerpt_en: One or two sentences that summarize the post. Shown in the post list and as the lead paragraph.
excerpt_vi: Một hoặc hai câu tóm tắt bài viết. Hiển thị ở trang danh sách và làm đoạn mở đầu.
tags: [ROS2, Nav2, Robotics]
---

<!--
  HƯỚNG DẪN NHANH:
  1. Đổi "slug" thành tên file không dấu, không cách (dùng dấu gạch ngang).
     File này nên được đổi tên thành: <slug>.md
  2. Điền đầy đủ các trường date / title_en / title_vi / excerpt_en / excerpt_vi / tags.
  3. Viết nội dung bên dưới theo CẶP EN/VI, mỗi đoạn bọc trong khối
     :::en ... ::: và :::vi ... ::: như ví dụ bên dưới.
  4. Chạy: python3 scripts/build-blog.py
     → Script sẽ tự tạo blog/posts/<slug>.html và cập nhật blog/posts.json
  5. Không cần sửa blog/index.html — nó tự đọc posts.json.
-->

:::en
## Section heading in English

Write your paragraph here. You can use **bold**, *italic*, `inline code`,
and [links](https://example.com).

- Bullet point one
- Bullet point two

```bash
echo "code blocks work too"
```
:::

:::vi
## Tiêu đề mục bằng tiếng Việt

Viết đoạn văn của bạn ở đây. Bạn có thể dùng **in đậm**, *in nghiêng*,
`code inline`, và [liên kết](https://example.com).

- Gạch đầu dòng một
- Gạch đầu dòng hai

```bash
echo "code block cũng hoạt động"
```
:::
