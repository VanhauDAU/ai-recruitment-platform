import { SALARY_RANGES } from '@/entities/job/job'

// Mặc định khi chưa có cấu hình; admin đổi bằng SiteSetting home_featured_jobs_count.
export const BEST_JOBS_PAGE_SIZE = 12
export const BEST_JOBS_ROTATE_MS = 8000
export const BEST_JOBS_PREVIEW_DELAY_MS = 500

function createRotationSeed() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replaceAll('-', '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

// Một application load dùng cùng seed để phân trang không lặp; F5 tải module
// lại và tạo seed mới, nên tập/thứ tự card được luân phiên như box của TopCV.
export const BEST_JOBS_ROTATION_SEED = createRotationSeed()

export const BEST_JOBS_DIMENSIONS = [
  { key: 'location', label: 'Địa điểm' },
  { key: 'salary', label: 'Mức lương' },
  { key: 'experience', label: 'Kinh nghiệm' },
  { key: 'category', label: 'Ngành nghề' },
]

const EXPERIENCE_FILTER_OPTIONS = [
  { value: null, label: 'Tất cả' },
  { value: 'none', label: 'Chưa có kinh nghiệm' },
  { value: 'under_1', label: 'Dưới 1 năm' },
  { value: '1', label: '1 năm' },
  { value: '2', label: '2 năm' },
  { value: '3', label: '3 năm' },
  { value: '4', label: '4 năm' },
  { value: '5', label: '5 năm' },
  { value: 'over_5', label: 'Trên 5 năm' },
]

export const EMPTY_BEST_JOBS_FILTERS = {
  location: null,
  salary: null,
  experience: null,
  category: null,
}

const LOCATION_CHIP_LIMIT = 20
const shortProvince = (name = '') => name.replace(/^Thành phố |^Tỉnh /, '')
const shortWard = (name = '') => name.replace(/^Phường |^Xã |^Đặc khu /, '')

// `locations` là kết quả /public/jobs/best/locations/: chỉ nơi đang có tin,
// đã sắp nhiều tin trước. Tỉnh đứng trước phường/xã; mỗi chip kèm số tin.
export function buildBestJobsChips(dimension, { locations, parents = [] } = {}) {
  if (dimension === 'location') {
    const provinceChips = (locations?.provinces ?? []).map((province) => ({
      value: province.id,
      label: shortProvince(province.name),
      count: province.job_count,
    }))
    const wardChips = (locations?.wards ?? []).map((ward) => ({
      value: ward.id,
      label: ward.parent_name
        ? `${shortWard(ward.name)}, ${shortProvince(ward.parent_name)}`
        : shortWard(ward.name),
      count: ward.job_count,
    }))
    return [
      { value: null, label: 'Ngẫu nhiên' },
      ...[...provinceChips, ...wardChips].slice(0, LOCATION_CHIP_LIMIT),
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

export function buildBestJobsParams(filters, page, rotationSeed = BEST_JOBS_ROTATION_SEED, pageSize = BEST_JOBS_PAGE_SIZE) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    rotation_seed: rotationSeed,
  })
  if (filters.location) params.append('location', filters.location)
  if (filters.category) params.append('category', filters.category)
  if (filters.experience) {
    params.set('experience_years', filters.experience)
  }
  if (filters.salary === 'negotiable') params.set('salary_negotiable', '1')
  else if (filters.salary) params.set('salary_bucket', filters.salary)
  return params
}
