export const CAMPAIGN_FUNNEL_STAGES = [
  { key: 'submitted', label: 'Mới', color: '#f59e0b', dotClass: 'bg-amber-500' },
  { key: 'viewed', label: 'Đã xem', color: '#0ea5e9', dotClass: 'bg-sky-500' },
  { key: 'considering', label: 'Cân nhắc', color: '#6366f1', dotClass: 'bg-indigo-500' },
  { key: 'shortlisted', label: 'Phù hợp', color: '#8b5cf6', dotClass: 'bg-violet-500' },
  { key: 'interviewed', label: 'Phỏng vấn', color: '#ec4899', dotClass: 'bg-pink-500' },
  { key: 'accepted', label: 'Đã tuyển', color: '#10b981', dotClass: 'bg-emerald-500' },
  { key: 'rejected', label: 'Từ chối', color: '#f43f5e', dotClass: 'bg-rose-500' },
]

export const CAMPAIGN_PERFORMANCE_METRICS = [
  { key: 'impressions', label: 'Hiển thị' },
  { key: 'views', label: 'Xem tin' },
  { key: 'applications', label: 'Ứng tuyển' },
  { key: 'view_rate', label: 'Tỷ lệ xem', rate: true },
  { key: 'application_rate', label: 'Tỷ lệ ứng tuyển', rate: true },
]
