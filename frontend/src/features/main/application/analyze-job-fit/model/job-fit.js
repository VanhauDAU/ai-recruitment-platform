// Từ vựng và quy tắc trình bày kết quả phân tích; khóa khớp `result_json` của
// backend (apps/matching/services/scoring, explain).

const ACTIVE_STATUSES = new Set(['queued', 'processing'])

export function isAnalysisActive(analysis) {
  return ACTIVE_STATUSES.has(analysis?.status)
}

// Mức, nhãn tiêu chí, độ tin cậy: `entities/application/job-fit` (dùng chung với cổng
// nhà tuyển dụng).

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

