import { SALARY_RANGES } from '../../../../constants/jobOptions'

export const BEST_JOBS_PAGE_SIZE = 12
export const BEST_JOBS_ROTATE_MS = 8000
export const BEST_JOBS_PREVIEW_DELAY_MS = 500
export const OTHER_WARDS_VALUE = '__other_wards__'

export const BEST_JOBS_DIMENSIONS = [
  { key: 'location', label: 'Địa điểm' },
  { key: 'salary', label: 'Mức lương' },
  { key: 'experience', label: 'Kinh nghiệm' },
  { key: 'category', label: 'Ngành nghề' },
]

export const BEST_JOBS_LOGO_TINTS = [
  ['#e6f0ff', '#2563eb'],
  ['#eafaf1', '#16a34a'],
  ['#fff1e6', '#ea580c'],
  ['#fdeaf1', '#db2777'],
  ['#f0edfb', '#7c3aed'],
  ['#fff7e0', '#ca8a04'],
]

export const EXPERIENCE_FILTER_OPTIONS = [
  { value: null, label: 'Tất cả' },
  { value: 'intern', label: 'Chưa có kinh nghiệm' },
  { value: 'fresher', label: '1 năm trở xuống' },
  { value: 'junior', label: '1 năm' },
  { value: 'middle', label: '2 năm' },
  { value: 'senior', label: '3 năm' },
  { value: 'four_to_five', label: 'Từ 4 - 5 năm', apiValue: 'senior' },
  { value: 'over_five', label: 'Trên 5 năm', apiValue: 'senior' },
]

export const EMPTY_BEST_JOBS_FILTERS = {
  location: null,
  salary: null,
  experience: null,
  category: null,
}

const LOCATION_CHIP_LIMIT = 15
const shortProvince = (name = '') => name.replace(/^Thành phố |^Tỉnh /, '')
const shortWard = (name = '') => name.replace(/^Phường |^Xã |^Đặc khu /, '')

export function buildBestJobsChips(dimension, { featuredWards, parents, provinces }) {
  if (dimension === 'location') {
    const provinceChips = provinces.slice(0, 8).map((province) => ({
      value: province.id,
      label: shortProvince(province.name),
    }))
    const provinceById = new Map(provinces.map((province) => [province.id, province]))
    const wardChips = featuredWards.map((ward) => {
      const province = provinceById.get(ward.parent)
      return {
        value: ward.id,
        label: province
          ? `${shortWard(ward.name)}, ${shortProvince(province.name)}`
          : shortWard(ward.name),
      }
    })
    return [
      { value: null, label: 'Tất cả' },
      ...[...provinceChips, ...wardChips].slice(0, LOCATION_CHIP_LIMIT),
      { value: OTHER_WARDS_VALUE, label: 'Các phường/xã còn lại', action: 'openLocations' },
    ]
  }
  if (dimension === 'salary') {
    return [
      { value: null, label: 'Tất cả' },
      ...SALARY_RANGES.map((range) => ({ value: range.key, label: range.label })),
      { value: 'negotiable', label: 'Thỏa thuận' },
    ]
  }
  if (dimension === 'experience') return EXPERIENCE_FILTER_OPTIONS
  return [
    { value: null, label: 'Tất cả' },
    ...parents.map((category) => ({ value: category.id, label: category.name })),
  ]
}

export function buildBestJobsParams(filters, page) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(BEST_JOBS_PAGE_SIZE),
  })
  if (filters.location) params.append('location', filters.location)
  if (filters.category) params.append('category', filters.category)
  if (filters.experience) {
    const option = EXPERIENCE_FILTER_OPTIONS.find((item) => item.value === filters.experience)
    params.set('experience_level', option?.apiValue || filters.experience)
  }
  if (filters.salary === 'negotiable') params.set('salary_negotiable', '1')
  else if (filters.salary) params.set('salary_bucket', filters.salary)
  return params
}
