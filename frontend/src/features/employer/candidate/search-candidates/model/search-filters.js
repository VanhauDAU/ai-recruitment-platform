/** Bộ lọc Tìm CV: trạng thái trên form và tham số gửi API (danh sách gửi dạng "a,b"). */
export const EMPTY_FILTERS = {
  q: '',
  all_keywords: [],
  any_keywords: [],
  none_keywords: [],
  province: undefined,
  category: undefined,
  language: undefined,
  language_level: undefined,
  min_years: null,
  max_years: null,
  position_level: undefined,
  education: undefined,
  title: '',
  school: '',
}

export const PAGE_SIZES = [10, 20, 50]

const LIST_KEYS = ['all_keywords', 'any_keywords', 'none_keywords']
const TEXT_KEYS = ['q', 'title', 'school']
const CHOICE_KEYS = ['province', 'category', 'language', 'position_level', 'education']

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

export function filtersToParams(filters) {
  const params = {}
  for (const key of TEXT_KEYS) {
    const text = filters[key]?.trim()
    if (text) params[key] = text
  }
  for (const key of LIST_KEYS) {
    const values = filters[key].map((value) => value.replaceAll(',', ' ').trim()).filter(Boolean)
    if (values.length) params[key] = values.join(',')
  }
  for (const key of CHOICE_KEYS) {
    if (hasValue(filters[key])) params[key] = filters[key]
  }
  if (params.language && filters.language_level) params.language_level = filters.language_level
  if (hasValue(filters.min_years)) params.min_months = Math.round(filters.min_years * 12)
  if (hasValue(filters.max_years)) params.max_months = Math.round(filters.max_years * 12)
  return params
}

/** Số nhóm lọc đang dùng (nhãn nút "Bộ lọc" trên màn hẹp). */
export function activeFilterCount(filters) {
  const params = filtersToParams(filters)
  return Object.keys(params).filter((key) => key !== 'language_level' && key !== 'max_months').length
    + (params.max_months !== undefined && params.min_months === undefined ? 1 : 0)
}
