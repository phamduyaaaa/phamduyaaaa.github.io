/**
 * Danh sách toàn bộ ảnh & video kỷ niệm lễ tốt nghiệp của Phạm Đức Duy
 * Sắp xếp theo nhóm chủ đề trực quan, hỗ trợ phân loại & lọc UX/UI
 */

window.MEMORY_CATEGORIES = [
  { id: 'all', label: 'Tất Cả', icon: '✦' },
  { id: 'portrait', label: 'Chân Dung', icon: '🎓' },
  { id: 'family', label: 'Gia Đình', icon: '❤️' },
  { id: 'lab', label: 'Haibot Lab', icon: '🔬' },
  { id: 'k17', label: 'K17 Robot & AI', icon: '🤖' },
  { id: 'moments', label: 'Trường Lớp & Kỷ Niệm', icon: '🏛️' },
  { id: 'video', label: 'Video', icon: '🎬' }
];

window.MEMORY_MEDIA = [
  // 1. CHÂN DUNG CỬ NHÂN
  {
    type: 'image',
    filename: 'only_me.jpg',
    src: 'imgs/memory_imgs/only_me.jpg',
    title: 'Chân dung Cử nhân',
    caption: 'Phạm Đức Duy trong lễ tốt nghiệp Cử nhân Robot & AI',
    category: 'portrait',
    categoryLabel: 'Chân Dung'
  },
  {
    type: 'image',
    filename: 'only_me_graduation.jpg',
    src: 'imgs/memory_imgs/only_me_graduation.jpg',
    title: 'Rạng rỡ ngày nhận bằng',
    caption: 'Cột mốc hoàn thành hành trình 4 năm đại học',
    category: 'portrait',
    categoryLabel: 'Chân Dung'
  },
  {
    type: 'image',
    filename: 'only_me_graduation_2.jpg',
    src: 'imgs/memory_imgs/only_me_graduation_2.jpg',
    title: 'Khoảnh khắc cử nhân HaUI',
    caption: 'Niềm vui trong ngày bế giảng & trao bằng',
    category: 'portrait',
    categoryLabel: 'Chân Dung'
  },
  {
    type: 'image',
    filename: 'only_me_board.jpg',
    src: 'imgs/memory_imgs/only_me_board.jpg',
    title: 'Lưu niệm bên bảng vinh danh',
    caption: 'Chụp hình kỷ niệm trước khu vực sân khấu lễ tốt nghiệp',
    category: 'portrait',
    categoryLabel: 'Chân Dung'
  },
  {
    type: 'image',
    filename: 'only_t3_a10.jpg',
    src: 'imgs/memory_imgs/only_t3_a10.jpg',
    title: 'Kỷ niệm sảnh A10',
    caption: 'Những góc thân quen của Đại học Công Nghiệp Hà Nội',
    category: 'portrait',
    categoryLabel: 'Chân Dung'
  },

  // 2. GIA ĐÌNH THÂN YÊU
  {
    type: 'image',
    filename: 'my_mother.jpg',
    src: 'imgs/memory_imgs/my_mother.jpg',
    title: 'Mẹ kính yêu',
    caption: 'Chỗ dựa lớn nhất và niềm tự hào của con',
    category: 'family',
    categoryLabel: 'Gia Đình'
  },
  {
    type: 'image',
    filename: 'and_my_mother.jpg',
    src: 'imgs/memory_imgs/and_my_mother.jpg',
    title: 'Hai mẹ con ngày tốt nghiệp',
    caption: 'Khoảnh khắc hạnh phúc cùng mẹ trong ngày nhận bằng',
    category: 'family',
    categoryLabel: 'Gia Đình'
  },
  {
    type: 'image',
    filename: 'my_young_sister.jpg',
    src: 'imgs/memory_imgs/my_young_sister.jpg',
    title: 'Em gái nhỏ',
    caption: 'Em gái nhỏ đến chúc mừng anh hai tốt nghiệp',
    category: 'family',
    categoryLabel: 'Gia Đình'
  },
  {
    type: 'image',
    filename: 'and_my_family.jpg',
    src: 'imgs/memory_imgs/and_my_family.jpg',
    title: 'Gia đình trọn vẹn yêu thương',
    caption: 'Gia đình cùng chung vui ngày lễ tốt nghiệp',
    category: 'family',
    categoryLabel: 'Gia Đình'
  },
  {
    type: 'image',
    filename: 'and_my_family_2.jpg',
    src: 'imgs/memory_imgs/and_my_family_2.jpg',
    title: 'Nụ cười bên gia đình',
    caption: 'Khoảnh khắc sum vầy ấm áp của cả nhà',
    category: 'family',
    categoryLabel: 'Gia Đình'
  },
  {
    type: 'image',
    filename: 'and_my_family_3.jpg',
    src: 'imgs/memory_imgs/and_my_family_3.jpg',
    title: 'Kỷ niệm sum vầy ngày lễ lớn',
    caption: 'Lưu giữ những nụ cười rạng rỡ của gia đình',
    category: 'family',
    categoryLabel: 'Gia Đình'
  },

  // 3. HAIBOT LAB
  {
    type: 'image',
    filename: 'haibotlab_all.jpg',
    src: 'imgs/memory_imgs/haibotlab_all.jpg',
    title: 'Đại gia đình Haibot Lab',
    caption: 'Tập thể Haibot Lab trong ngày tốt nghiệp',
    category: 'lab',
    categoryLabel: 'Haibot Lab'
  },
  {
    type: 'image',
    filename: 'haibotlab_ahoc_k14.jpg',
    src: 'imgs/memory_imgs/haibotlab_ahoc_k14.jpg',
    title: 'Cùng anh Học K14',
    caption: 'Kỷ niệm đẹp cùng tiền bối Haibot Lab',
    category: 'lab',
    categoryLabel: 'Haibot Lab'
  },
  {
    type: 'image',
    filename: 'haibotlab_atai_k16.jpg',
    src: 'imgs/memory_imgs/haibotlab_atai_k16.jpg',
    title: 'Cùng anh Tài K16',
    caption: 'Người anh đồng hành gắn bó tại lab',
    category: 'lab',
    categoryLabel: 'Haibot Lab'
  },
  {
    type: 'image',
    filename: 'haibotlab_atai_minh_gay.jpg',
    src: 'imgs/memory_imgs/haibotlab_atai_minh_gay.jpg',
    title: 'Cùng anh Tài & Minh',
    caption: 'Những đồng đội thân thiết nhất tại phòng lab',
    category: 'lab',
    categoryLabel: 'Haibot Lab'
  },
  {
    type: 'image',
    filename: 'haibotlab_cdiep_k16.jpg',
    src: 'imgs/memory_imgs/haibotlab_cdiep_k16.jpg',
    title: 'Cùng chị Điệp K16',
    caption: 'Khoảnh khắc kỷ niệm cùng chị Điệp Haibot Lab',
    category: 'lab',
    categoryLabel: 'Haibot Lab'
  },
  {
    type: 'image',
    filename: 'haibotlab_k18.jpg',
    src: 'imgs/memory_imgs/haibotlab_k18.jpg',
    title: 'Thế hệ K18 Haibot Lab',
    caption: 'Giao lưu cùng các em K18 tiếp nối đam mê nghiên cứu',
    category: 'lab',
    categoryLabel: 'Haibot Lab'
  },
  {
    type: 'image',
    filename: 'haibotlab_k19.jpg',
    src: 'imgs/memory_imgs/haibotlab_k19.jpg',
    title: 'Thế hệ K19 Haibot Lab',
    caption: 'Các thành viên trẻ đầy nhiệt huyết của lab',
    category: 'lab',
    categoryLabel: 'Haibot Lab'
  },
  {
    type: 'image',
    filename: 'haibotlab_dinner.jpg',
    src: 'imgs/memory_imgs/haibotlab_dinner.jpg',
    title: 'Bữa tiệc liên hoan Haibot Lab',
    caption: 'Buổi gặp gỡ ấm cúng chúc mừng tốt nghiệp',
    category: 'lab',
    categoryLabel: 'Haibot Lab'
  },

  // 4. BẠN BÈ K17 ROBOT & AI
  {
    type: 'image',
    filename: 'k17_all_1.jpg',
    src: 'imgs/memory_imgs/k17_all_1.jpg',
    title: 'Tập thể K17 Robot & AI (1)',
    caption: 'Lớp Robot & Trí tuệ nhân tạo K17 ngày nhận bằng',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_all_2.jpg',
    src: 'imgs/memory_imgs/k17_all_2.jpg',
    title: 'Tập thể K17 Robot & AI (2)',
    caption: 'Đại gia đình Robot K17 trước hội trường A11',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_all_4.jpg',
    src: 'imgs/memory_imgs/k17_all_4.jpg',
    title: 'Tập thể K17 Robot & AI (3)',
    caption: 'Những người bạn đồng hành suốt 4 năm đèn sách',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_all_5.jpg',
    src: 'imgs/memory_imgs/k17_all_5.jpg',
    title: 'Tập thể K17 Robot & AI (4)',
    caption: 'Rực rỡ sắc màu cử nhân của lớp Robot K17',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_all_6.jpg',
    src: 'imgs/memory_imgs/k17_all_6.jpg',
    title: 'Tập thể K17 Robot & AI (5)',
    caption: 'Khoảnh khắc rạng rỡ của các kỹ sư/cử nhân tương lai',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_all_7.jpg',
    src: 'imgs/memory_imgs/k17_all_7.jpg',
    title: 'Tập thể K17 Robot & AI (6)',
    caption: 'Kỷ niệm không thể nào quên của thanh xuân HaUI',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_all_8.jpg',
    src: 'imgs/memory_imgs/k17_all_8.jpg',
    title: 'Tập thể K17 Robot & AI (7)',
    caption: 'Nụ cười tỏa nắng của tập thể K17',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_all_9.jpg',
    src: 'imgs/memory_imgs/k17_all_9.jpg',
    title: 'Tập thể K17 Robot & AI (8)',
    caption: 'Chặng đường 2022 - 2026 khép lại đầy viên mãn',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_all_10.jpg',
    src: 'imgs/memory_imgs/k17_all_10.jpg',
    title: 'Tập thể K17 Robot & AI (9)',
    caption: 'Góc chụp toàn cảnh bạn bè K17',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_all_11.jpg',
    src: 'imgs/memory_imgs/k17_all_11.jpg',
    title: 'Tập thể K17 Robot & AI (10)',
    caption: 'Kỷ niệm đẹp cùng thầy cô và bạn bè đồng khóa',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_all_12.jpg',
    src: 'imgs/memory_imgs/k17_all_12.jpg',
    title: 'Tập thể K17 Robot & AI (11)',
    caption: 'Những cái ôm và lời chúc mừng ngày tốt nghiệp',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_3ae.jpg',
    src: 'imgs/memory_imgs/k17_3ae.jpg',
    title: 'Ba anh em thân thiết K17',
    caption: 'Hội bạn thân cùng sát cánh qua bao đồ án khó',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_4ae.jpg',
    src: 'imgs/memory_imgs/k17_4ae.jpg',
    title: 'Bốn anh em thân thiết K17',
    caption: 'Hội bạn thân cùng sát cánh qua những năm tháng đại học',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_minh_gay.jpg',
    src: 'imgs/memory_imgs/k17_minh_gay.jpg',
    title: 'Cùng bạn Minh K17',
    caption: 'Người bạn thân đồng hành suốt những năm tháng đại học',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k17_rb_4.jpg',
    src: 'imgs/memory_imgs/k17_rb_4.jpg',
    title: 'Nhóm bạn K17 Robotics',
    caption: 'Khoảnh khắc tươi vui bên bạn bè đồng môn',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },
  {
    type: 'image',
    filename: 'k18_rb.jpg',
    src: 'imgs/memory_imgs/k18_rb.jpg',
    title: 'Giao lưu cùng K18 Robotics',
    caption: 'Các thế hệ sinh viên ngành Robot HaUI hội tụ',
    category: 'k17',
    categoryLabel: 'K17 Robot'
  },

  // 5. TRƯỜNG LỚP & HẬU TRƯỜNG
  {
    type: 'image',
    filename: 'pre.jpg',
    src: 'imgs/memory_imgs/pre.jpg',
    title: 'Chuẩn bị trước giờ G (1)',
    caption: 'Hậu trường chuẩn bị trang phục và hoa chúc mừng',
    category: 'moments',
    categoryLabel: 'Kỷ Niệm'
  },
  {
    type: 'image',
    filename: 'pre_2.jpg',
    src: 'imgs/memory_imgs/pre_2.jpg',
    title: 'Chuẩn bị trước giờ G (2)',
    caption: 'Tâm trạng hồi hộp trước khi bước vào lễ đường trao bằng',
    category: 'moments',
    categoryLabel: 'Kỷ Niệm'
  },
  {
    type: 'image',
    filename: 'pre_3.jpg',
    src: 'imgs/memory_imgs/pre_3.jpg',
    title: 'Chuẩn bị trước giờ G (3)',
    caption: 'Chỉnh trang áo mũ cử nhân thật tươm tất',
    category: 'moments',
    categoryLabel: 'Kỷ Niệm'
  },
  {
    type: 'image',
    filename: 'pre_4.jpg',
    src: 'imgs/memory_imgs/pre_4.jpg',
    title: 'Chuẩn bị trước giờ G (4)',
    caption: 'Lưu lại những khoảnh khắc tự nhiên trước buổi lễ',
    category: 'moments',
    categoryLabel: 'Kỷ Niệm'
  },
  {
    type: 'image',
    filename: 'pre_5.jpg',
    src: 'imgs/memory_imgs/pre_5.jpg',
    title: 'Chuẩn bị trước giờ G (5)',
    caption: 'Không khí rộn ràng đón người thân và bạn bè đến dự',
    category: 'moments',
    categoryLabel: 'Kỷ Niệm'
  },
  {
    type: 'image',
    filename: 'inside.jpg',
    src: 'imgs/memory_imgs/inside.jpg',
    title: 'Hội trường lễ tốt nghiệp',
    caption: 'Bên trong hội trường trang trọng ngày bế giảng',
    category: 'moments',
    categoryLabel: 'Không Gian'
  },
  {
    type: 'image',
    filename: 'library.jpg',
    src: 'imgs/memory_imgs/library.jpg',
    title: 'Thư viện ĐH Công Nghiệp',
    caption: 'Nơi gắn liền với những đêm ôn thi và tra cứu tài liệu',
    category: 'moments',
    categoryLabel: 'Không Gian'
  },
  {
    type: 'image',
    filename: 'surround.jpg',
    src: 'imgs/memory_imgs/surround.jpg',
    title: 'Khuôn viên trường HaUI',
    caption: 'Toàn cảnh ngôi trường thân yêu trong ngày lễ lớn',
    category: 'moments',
    categoryLabel: 'Không Gian'
  },
  {
    type: 'image',
    filename: 'surround_2.jpg',
    src: 'imgs/memory_imgs/surround_2.jpg',
    title: 'Khuôn viên rực rỡ cờ hoa',
    caption: 'Sân trường tấp nập tân cử nhân và người thân',
    category: 'moments',
    categoryLabel: 'Không Gian'
  },
  {
    type: 'image',
    filename: 'them.jpg',
    src: 'imgs/memory_imgs/them.jpg',
    title: 'Nụ cười bạn bè',
    caption: 'Khoảnh khắc rạng rỡ của bạn bè ngày tốt nghiệp',
    category: 'moments',
    categoryLabel: 'Kỷ Niệm'
  },

  // 6. VIDEO KỶ NIỆM
  {
    type: 'video',
    filename: 'graduation.mp4',
    src: 'imgs/memory_videos/graduation.mp4',
    title: 'Thước phim Lễ Tốt Nghiệp 2026',
    caption: 'Video ghi lại toàn cảnh những khoảnh khắc đáng nhớ nhất ngày 16.08.2026',
    category: 'video',
    categoryLabel: 'Video Kỷ Niệm'
  }
];

// Danh sách tệp ảnh để đảm bảo tương thích ngược hoàn hảo
window.MEMORY_IMAGE_FILES = window.MEMORY_MEDIA
  .filter(function(item) { return item.type === 'image'; })
  .map(function(item) { return item.filename; });
