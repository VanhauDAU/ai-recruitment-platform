export const ASSISTANT_ACTIONS = Object.freeze({
  findJobs: { id: 'findJobs', label: 'Tìm việc phù hợp', to: '/viec-lam' },
  createCv: { id: 'createCv', label: 'Tạo CV miễn phí', to: '/mau-cv' },
  savedJobs: { id: 'savedJobs', label: 'Việc làm đã lưu', to: '/viec-lam-da-luu', requiresLoginPrompt: true },
  profile: { id: 'profile', label: 'Hồ sơ của tôi', to: '/tai-khoan/thong-tin-ca-nhan' },
  matchingJobs: { id: 'matchingJobs', label: 'Gợi ý việc làm cho tôi', to: '/tai-khoan/viec-lam-phu-hop' },
  zalo: { id: 'zalo', label: 'Chat qua Zalo', kind: 'zalo' },
  hotline: { id: 'hotline', label: 'Gọi hotline', kind: 'hotline' },
})

export const INITIAL_MESSAGE = Object.freeze({
  id: 'welcome',
  from: 'assistant',
  text: 'Chào bạn! Mình là trợ lý ProCV. Mình có thể hướng dẫn nhanh về tìm việc, CV và ứng tuyển.',
  actions: ['findJobs', 'createCv', 'matchingJobs'],
})

export const ASSISTANT_SCRIPT = Object.freeze([
  {
    id: 'greeting',
    match: ['xin chao', 'chao ban', 'hello', 'hi', 'tro ly'],
    reply: 'Chào bạn! Hôm nay bạn muốn tìm việc mới, tạo CV hay xem các gợi ý dành riêng cho mình?',
    emotion: 'happy',
    actions: ['findJobs', 'createCv', 'matchingJobs'],
  },
  {
    id: 'create-cv',
    match: ['tao cv', 'mau cv', 'viet cv', 'lam cv', 'ho so xin viec'],
    reply: 'Bạn có thể chọn mẫu CV, điền nội dung và chỉnh sửa trực tiếp. Hãy bắt đầu từ thư viện mẫu miễn phí nhé.',
    emotion: 'success',
    actions: ['createCv', 'profile'],
  },
  {
    id: 'apply',
    match: ['ung tuyen', 'nop ho so', 'apply'],
    reply: 'Mở tin tuyển dụng phù hợp, chọn “Ứng tuyển ngay”, rồi chọn CV muốn gửi. Bạn nên kiểm tra kỹ CV và thông tin liên hệ trước khi xác nhận.',
    emotion: 'happy',
    actions: ['findJobs', 'profile'],
  },
  {
    id: 'job-search',
    match: ['tim viec', 'viec lam', 'nganh', 'dia diem', 'muc luong'],
    reply: 'Bạn có thể tìm theo vị trí, công ty và địa điểm, sau đó dùng bộ lọc để thu hẹp kết quả. Mục gợi ý việc làm sẽ cá nhân hóa tốt hơn khi hồ sơ đầy đủ.',
    emotion: 'thinking',
    actions: ['findJobs', 'matchingJobs'],
  },
  {
    id: 'cv-tips',
    match: ['meo cv', 'cv tot', 'cv dep', 'kinh nghiem cv'],
    reply: 'Một CV tốt nên ngắn gọn, ưu tiên thành tựu có số liệu, dùng từ khóa sát mô tả công việc và chỉ giữ thông tin liên quan đến vị trí ứng tuyển.',
    emotion: 'success',
    actions: ['createCv', 'profile'],
  },
  {
    id: 'saved-jobs',
    match: ['da luu', 'viec luu', 'tin luu'],
    reply: 'Bạn có thể mở danh sách việc làm đã lưu để xem lại và tiếp tục ứng tuyển khi sẵn sàng.',
    emotion: 'happy',
    actions: ['savedJobs'],
  },
  {
    id: 'support',
    match: ['ho tro', 'lien he', 'zalo', 'hotline', 'tu van'],
    reply: 'Bạn có thể liên hệ đội ngũ hỗ trợ qua kênh Zalo hoặc hotline đang được cấu hình trên website.',
    emotion: 'neutral',
    actions: ['zalo', 'hotline'],
  },
])

export const DEFAULT_REPLY = Object.freeze({
  id: 'fallback',
  reply: 'Mình chưa hiểu trọn vẹn câu hỏi này. Trong giai đoạn thử nghiệm, bạn có thể chọn một trong các hướng dẫn nhanh bên dưới.',
  emotion: 'thinking',
  actions: ['findJobs', 'createCv', 'matchingJobs'],
})

