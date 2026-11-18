// Tiêu chuẩn tệp CV — khớp backend (apps/cvs/services/cv_document.py, imports.py).
// Trình duyệt chỉ kiểm tra sớm định dạng/dung lượng; máy chủ kiểm tra nội dung.
export const CV_MAX_BYTES = 5 * 1024 * 1024
export const CV_ACCEPT = '.pdf,.docx'

export const CV_UPLOAD_STANDARDS = [
  'Định dạng PDF hoặc DOCX, dung lượng tối đa 5MB, không quá 20 trang.',
  'PDF cần có lớp chữ (không phải ảnh scan) và không đặt mật khẩu.',
  'Có email hoặc số điện thoại cùng các mục như kinh nghiệm, học vấn, kỹ năng.',
]

export function cvFileProblem(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!['pdf', 'docx'].includes(extension)) return 'Chỉ hỗ trợ tệp PDF hoặc DOCX.'
  if (file.size > CV_MAX_BYTES) return 'Tệp CV không được vượt quá 5MB.'
  return ''
}
