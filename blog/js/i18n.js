/* ============================================================
   I18N ENGINE — EN / VI toggle cho blog
   Cách dùng trong HTML:
     <span data-en="Hello">Xin chào</span>  → sai thứ tự, xem quy tắc dưới
   Quy tắc: bọc 2 phần tử riêng biệt, mỗi phần tử 1 ngôn ngữ:
     <span data-en>Hello world</span>
     <span data-vi>Xin chào thế giới</span>
   CSS (blog.css) sẽ ẩn/hiện dựa trên [lang] của <html>.
   Lựa chọn ngôn ngữ được lưu vào localStorage, key "blog-lang".
   ============================================================ */
(function () {
  var STORAGE_KEY = 'blog-lang';

  function getPreferredLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'vi') return saved;
    } catch (e) { /* localStorage bị chặn (private mode) — bỏ qua */ }
    // Chưa từng chọn trước đó: giữ mặc định của trang (VI), khớp với
    // <html lang="vi"> đã set sẵn để tránh flash nội dung khi JS chạy.
    return 'vi';
  }

  function applyLang(lang) {
    document.documentElement.setAttribute('lang', lang);
    var buttons = document.querySelectorAll('.lang-btn');
    buttons.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
      btn.setAttribute('aria-pressed', btn.getAttribute('data-lang') === lang ? 'true' : 'false');
    });
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function setLang(lang) {
    applyLang(lang);
  }

  // Khởi tạo ngay khi DOM sẵn sàng để tránh flash sai ngôn ngữ
  document.addEventListener('DOMContentLoaded', function () {
    applyLang(getPreferredLang());
    var buttons = document.querySelectorAll('.lang-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setLang(btn.getAttribute('data-lang'));
      });
    });
  });

  // Expose ra ngoài phòng khi cần gọi thủ công
  window.blogI18n = { setLang: setLang, getPreferredLang: getPreferredLang };
})();
