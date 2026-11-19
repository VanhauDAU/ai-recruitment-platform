/**
 * Tiêu đề tab/SERP của trang danh sách việc làm. Khác H1 ở chỗ bỏ nhãn
 * "[Update ngày]" và phần "(sau sáp nhập)": tiêu đề tìm kiếm phải ổn định,
 * "mới nhất" đã nói độ mới như các trang tuyển dụng lớn.
 */
export function buildJobListTitle({ count, contextLabel, loading }) {
  const resultLabel = loading ? 'việc làm' : `${count} việc làm`

  return ['Tuyển dụng', resultLabel, contextLabel, 'mới nhất'].filter(Boolean).join(' ')
}

/** "Tuyển <vị trí> - <công ty>" như tin trên các trang tuyển dụng lớn; không lặp "Tuyển". */
export function buildJobDetailTitle({ title, companyName }) {
  const position = String(title || '').trim()
  const heading = /^tuyển\s/i.test(position) ? position : `Tuyển ${position}`
  return companyName ? `${heading} - ${companyName}` : heading
}
