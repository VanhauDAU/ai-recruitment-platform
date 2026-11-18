// Quy tắc hiển thị một CV khi ứng viên chọn CV để ứng tuyển / phân tích.
// Nhà tuyển dụng nhận phiên bản đã lưu gần nhất (CV online) hoặc đúng tệp gốc (CV tải lên).

const PARSING = ['queued', 'processing']

/** CV nộp được ngay: đủ nội dung (hoặc có tệp) và không còn đang đọc tệp nhập vào. */
export function isCvApplicationReady(cv) {
  return cv.application_ready !== false && !PARSING.includes(cv.processing_status)
}

/** { text, hint, tone, editable }: nhãn trạng thái, lời giải thích, và có mời sửa CV không. */
export function cvChoiceStatus(cv) {
  if (PARSING.includes(cv.processing_status)) {
    return { text: 'Đang đọc tệp CV', hint: 'Hệ thống đang đọc nội dung tệp. Vui lòng thử lại sau ít phút.' }
  }
  if (cv.cv_type === 'uploaded') {
    // CV tải lên được nộp bằng chính tệp gốc nên không có gì để sửa trên hệ thống.
    return cv.application_ready === false
      ? { text: 'Thiếu tệp CV', hint: 'Không tìm thấy tệp của CV này. Hãy tải tệp lên lại.' }
      : {}
  }
  if (cv.application_ready === false) {
    return {
      text: 'Chưa đủ thông tin',
      hint: 'CV cần có họ tên, email hoặc số điện thoại và ít nhất một mục nội dung (giới thiệu, kinh nghiệm, dự án, học vấn hoặc kỹ năng) mới dùng để ứng tuyển được.',
      editable: true,
    }
  }
  if (cv.has_unsaved_changes) {
    return {
      text: 'Có chỉnh sửa chưa lưu',
      hint: 'Nhà tuyển dụng sẽ nhận bản đã lưu gần nhất. Mở CV và bấm Lưu để gửi bản mới.',
      editable: true,
    }
  }
  if (cv.is_complete === false) return { text: 'Nên hoàn thiện thêm', tone: 'soft', editable: true }
  return {}
}
