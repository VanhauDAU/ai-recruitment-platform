// Xếp hữu cơ, một mốc là lần đăng đầu (ADR-0030); mặc định chính là "Mới đăng".
export const JOB_SORT_OPTIONS = [
  { value: '', label: 'Mới đăng' },
  { value: 'salary_desc', label: 'Lương cao nhất' },
  { value: 'closing_soon', label: 'Sắp hết hạn nộp' },
]

const SORT_VALUES = new Set(JOB_SORT_OPTIONS.map((option) => option.value))

// URL cũ (?sort=urgent, ?sort=newest) rơi về mặc định thay vì để API trả 400.
export function normalizeJobSort(value) {
  return value && SORT_VALUES.has(value) ? value : ''
}
