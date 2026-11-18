export const CAMPAIGN_FUNNEL_STAGES = [
  { key: 'submitted', label: 'Mới', color: '#f59e0b', dotClass: 'bg-amber-500' },
  { key: 'viewed', label: 'Đã xem', color: '#0ea5e9', dotClass: 'bg-sky-500' },
  { key: 'shortlisted', label: 'Phù hợp', color: '#8b5cf6', dotClass: 'bg-violet-500' },
  { key: 'interviewed', label: 'Phỏng vấn', color: '#ec4899', dotClass: 'bg-pink-500' },
  { key: 'accepted', label: 'Trúng tuyển', color: '#10b981', dotClass: 'bg-emerald-500' },
  { key: 'rejected', label: 'Không phù hợp', color: '#f43f5e', dotClass: 'bg-rose-500' },
]

export const CAMPAIGN_PERFORMANCE_METRICS = [
  { key: 'impressions', label: 'Hiển thị', help: 'Số lần tin của chiến dịch xuất hiện trong danh sách, kết quả tìm kiếm hay gợi ý trên ProCV.' },
  { key: 'views', label: 'Xem tin', help: 'Số lần ứng viên mở trang chi tiết tin.' },
  { key: 'applications', label: 'Ứng tuyển', help: 'Số lượt nộp hồ sơ vào các tin trong khoảng thời gian đã chọn.' },
  { key: 'view_rate', label: 'Tỷ lệ xem', rate: true, help: 'Xem tin ÷ hiển thị. Cho biết tiêu đề và mức lương có đủ hấp dẫn để người ta bấm vào không.' },
  { key: 'application_rate', label: 'Tỷ lệ ứng tuyển', rate: true, help: 'Ứng tuyển ÷ xem tin. Cho biết nội dung tin có thuyết phục người đã đọc nộp hồ sơ không.' },
]
