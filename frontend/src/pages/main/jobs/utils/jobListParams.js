export const PAGE_SIZE = 20
export const SALARY_UNIT = 1_000_000
export const SAVED_FILTER_KEY = 'saved_job_filter'
export const VISIBLE_GROUPS = 6

// URL gọn <-> param API backend. URL dùng key ngắn + gộp nhiều giá trị
// bằng dấu phẩy; `toApiParams` khai triển lại thành đúng param backend cần.
const SIMPLE_MAP = {
  wt: 'work_type',
  et: 'employment_type',
  level: 'position_level',
  weekend: 'weekend_policy',
  nganh: 'industry',
  sort: 'ordering',
}
const LIST_MAP = { cat: 'category', exp: 'experience_years' }

// Key filter trên URL (dùng cho "Xóa lọc" và kiểm tra đang có lọc).
export const FILTER_KEYS = ['cat', 'exp', 'wt', 'et', 'level', 'weekend', 'nganh', 'salary', 'sort']

function parseIdList(values) {
  return values
    .flatMap((value) => String(value || '').split(','))
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
}

export function getLocationIds(params) {
  return parseIdList([...params.getAll('location'), params.get('locations')])
}

// Đọc param nhiều giá trị dạng "a,b,c" trên URL.
export function getCommaList(params, key) {
  const raw = params.get(key)
  return raw ? raw.split(',').filter(Boolean) : []
}

// salary=10-15 | 10- | -15 | nego  (đơn vị triệu VND).
export function decodeSalary(value) {
  if (!value) return null
  if (value === 'nego') return { nego: true }
  const [gte, lte] = value.split('-')
  return {
    gte: gte ? Number(gte) * SALARY_UNIT : null,
    lte: lte ? Number(lte) * SALARY_UNIT : null,
  }
}

export function encodeSalary(gte, lte) {
  if (!gte && !lte) return null
  return `${gte ? gte / SALARY_UNIT : ''}-${lte ? lte / SALARY_UNIT : ''}`
}

// URL gọn -> URLSearchParams gửi cho API backend.
export function toApiParams(params) {
  const api = new URLSearchParams()
  for (const key of ['search', 'search_by', 'page']) {
    if (params.get(key)) api.set(key, params.get(key))
  }
  for (const [short, backend] of Object.entries(SIMPLE_MAP)) {
    if (params.get(short)) api.set(backend, params.get(short))
  }
  for (const [short, backend] of Object.entries(LIST_MAP)) {
    getCommaList(params, short).forEach((value) => api.append(backend, value))
  }
  getLocationIds(params).forEach((id) => api.append('location', id))
  const salary = decodeSalary(params.get('salary'))
  if (salary?.nego) api.set('salary_negotiable', '1')
  else if (salary) {
    if (salary.gte) api.set('salary_gte', salary.gte)
    if (salary.lte) api.set('salary_lte', salary.lte)
  }
  return api
}

export function slugifyVietnamese(text = '') {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function shortLocationName(name = '') {
  return name.replace(/^Thành phố |^Tỉnh /, '')
}

export function locationDisplayName(location) {
  if (!location) return ''
  if (location.level === 'province') return shortLocationName(location.name)
  return location.name
}

function joinLimitedLocationNames(locations, limit) {
  const names = locations.map(locationDisplayName).filter(Boolean)
  if (!names.length) return ''
  if (!Number.isFinite(limit) || names.length <= limit) return names.join(', ')
  return `${names.slice(0, limit).join(', ')},...`
}

export function formatLocationGroups(groups, { maxGroups = 2, maxWards = 2 } = {}) {
  if (!groups.length) return ''
  const visibleGroups = Number.isFinite(maxGroups) ? groups.slice(0, maxGroups) : groups
  const labels = visibleGroups.map(({ province, wards, allProvince }) => {
    if (!province) return joinLimitedLocationNames(wards, maxWards)
    if (allProvince || !wards.length) return locationDisplayName(province)
    return `${locationDisplayName(province)} (${joinLimitedLocationNames(wards, maxWards)})`
  }).filter(Boolean)
  if (!labels.length) return ''
  const suffix = Number.isFinite(maxGroups) && groups.length > maxGroups ? ',...' : ''
  return `${labels.join(', ')}${suffix}`
}

export function pathForLocation(ids, provinces) {
  if (!ids.length) return '/viec-lam'
  const province = provinces.find((item) => ids.includes(item.id))
  return province ? `/viec-lam/tai/${slugifyVietnamese(shortLocationName(province.name))}` : '/viec-lam'
}
