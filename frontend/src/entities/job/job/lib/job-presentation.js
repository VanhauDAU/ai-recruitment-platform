export const JOB_LOGO_TINTS = [
  ['#e6f0ff', '#2563eb'],
  ['#eafaf1', '#16a34a'],
  ['#fff1e6', '#ea580c'],
  ['#fdeaf1', '#db2777'],
  ['#f0edfb', '#7c3aed'],
  ['#fff7e0', '#ca8a04'],
]

// Nhãn do backend tính từ dữ liệu thật (ADR-0030): "Sắp hết hạn", "Phản hồi nhanh".
// Không có hạng trả phí hay nhãn gán tay, nên mọi thẻ tin dùng chung một kiểu.
export function jobLabels(job) {
  return job?.presentation?.labels ?? []
}
