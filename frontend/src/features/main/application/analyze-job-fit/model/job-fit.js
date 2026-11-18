// Từ vựng và quy tắc trình bày kết quả phân tích; khóa khớp `result_json` của
// backend (apps/matching/services/scoring, explain).

const ACTIVE_STATUSES = new Set(['queued', 'processing'])

export function isAnalysisActive(analysis) {
  return ACTIVE_STATUSES.has(analysis?.status)
}

// Bốn mức theo điểm tổng; `from` là điểm thấp nhất của mức.
export const FIT_BANDS = [
  { key: 'low', label: 'Chưa phù hợp', from: 0 },
  { key: 'medium', label: 'Tương đối phù hợp', from: 50 },
  { key: 'high', label: 'Phù hợp', from: 65 },
  { key: 'very_high', label: 'Rất phù hợp', from: 80 },
]

export const CRITERIA_LABELS = {
  skills: 'Kỹ năng',
  experience: 'Kinh nghiệm',
  education: 'Học vấn',
  position_level: 'Cấp bậc',
  languages: 'Ngoại ngữ',
  location: 'Địa điểm',
}

export const CONFIDENCE_COPY = {
  high: 'CV có đủ thông tin cho các tiêu chí.',
  medium: 'Một tiêu chí thiếu dữ liệu hoặc chỉ ước lượng được, kết quả có thể lệch.',
  low: 'Nhiều tiêu chí thiếu dữ liệu, kết quả chỉ mang tính tham khảo.',
}

export const STATUS_COPY = {
  insufficient_data: 'Chưa đủ dữ liệu',
  not_required: 'Tin không yêu cầu',
}

const ANALYSIS_ERROR_COPY = {
  cv_text_unavailable: 'Không đọc được chữ trong tệp CV (có thể là bản scan). Hãy tải lên PDF có thể bôi đen chữ hoặc dùng CV tạo trên hệ thống.',
  cv_insufficient_content: 'CV chưa có kỹ năng lẫn kinh nghiệm để so sánh. Bổ sung hai mục này rồi phân tích lại.',
  job_text_too_short: 'Tin tuyển dụng không đủ nội dung để phân tích.',
  analysis_timeout: 'Hệ thống phân tích đang bận. Thử lại sau ít phút.',
}

const REQUEST_ERROR_COPY = {
  feature_disabled: 'Tính năng xem độ phù hợp đang tạm tắt.',
  job_not_active: 'Tin tuyển dụng này không còn nhận phân tích.',
  cv_not_owned: 'Không tìm thấy CV này trong tài khoản của bạn.',
  cv_not_saved: 'CV chưa được lưu lần nào. Mở CV và bấm Lưu rồi phân tích lại.',
  job_text_too_short: ANALYSIS_ERROR_COPY.job_text_too_short,
}

export function analysisErrorCopy(code) {
  return ANALYSIS_ERROR_COPY[code] || 'Chưa phân tích được CV này. Thử lại hoặc chọn CV khác.'
}

export function requestErrorCopy(error) {
  if (error?.response?.status === 429) {
    return 'Bạn đã phân tích nhiều lần trong một giờ. Thử lại sau, các kết quả cũ vẫn xem được.'
  }
  return REQUEST_ERROR_COPY[error?.response?.data?.code] || 'Chưa gửi được yêu cầu phân tích. Thử lại sau.'
}

export function bandOf(score) {
  return [...FIT_BANDS].reverse().find((band) => score >= band.from) || FIT_BANDS[0]
}
