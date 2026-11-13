import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_YEARS_LABELS,
  SALARY_RANGES,
  WORK_TYPE_LABELS,
} from '@/entities/job'

export const JOB_ALERT_MANAGEMENT_PATH = '/tai-khoan/cai-dat-thong-bao-viec-lam'
export const JOB_PREFERENCE_SETTINGS_PATH = '/tai-khoan/cai-dat-goi-y-viec-lam'

export const JOB_ALERT_SCOPE_OPTIONS = [
  { value: 'title', label: 'Tên vị trí tuyển dụng' },
  { value: 'company', label: 'Tên công ty' },
  { value: 'both', label: 'Tên vị trí hoặc công ty' },
]

export const JOB_ALERT_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Hàng ngày' },
  { value: 'weekly', label: 'Hàng tuần' },
]

export const JOB_ALERT_SALARY_OPTIONS = SALARY_RANGES.map(({ key, label }) => ({
  value: key,
  label,
}))

export const JOB_ALERT_EXPERIENCE_OPTIONS = Object.entries(EXPERIENCE_YEARS_LABELS)
  .map(([value, label]) => ({ value, label }))
export const JOB_ALERT_WORK_TYPE_OPTIONS = Object.entries(WORK_TYPE_LABELS)
  .map(([value, label]) => ({ value, label }))
export const JOB_ALERT_EMPLOYMENT_TYPE_OPTIONS = Object.entries(EMPLOYMENT_TYPE_LABELS)
  .map(([value, label]) => ({ value, label }))

const SCOPE_VALUES = new Set(JOB_ALERT_SCOPE_OPTIONS.map(({ value }) => value))
const FREQUENCY_VALUES = new Set(JOB_ALERT_FREQUENCY_OPTIONS.map(({ value }) => value))
const SALARY_VALUES = new Set(JOB_ALERT_SALARY_OPTIONS.map(({ value }) => value))
const EXPERIENCE_VALUES = new Set(JOB_ALERT_EXPERIENCE_OPTIONS.map(({ value }) => value))
const WORK_TYPE_VALUES = new Set(JOB_ALERT_WORK_TYPE_OPTIONS.map(({ value }) => value))
const EMPLOYMENT_TYPE_VALUES = new Set(JOB_ALERT_EMPLOYMENT_TYPE_OPTIONS.map(({ value }) => value))

function nullableId(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function nullableEnum(value, allowed) {
  return allowed.has(value) ? value : null
}

function categoryIds(values) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))]
}

export function jobAlertFormValues(alert) {
  return {
    prefillNotice: alert?.prefillNotice || '',
    keyword: alert?.keyword || '',
    keyword_scope: SCOPE_VALUES.has(alert?.keyword_scope) ? alert.keyword_scope : 'title',
    category_ids: categoryIds(alert?.category_ids ?? alert?.categories?.map(({ id }) => id)),
    province_id: nullableId(alert?.province_id ?? alert?.province?.id),
    ward_id: nullableId(alert?.ward_id ?? alert?.ward?.id),
    salary_bucket: nullableEnum(alert?.salary_bucket, SALARY_VALUES),
    experience_years: nullableEnum(alert?.experience_years, EXPERIENCE_VALUES),
    work_type: nullableEnum(alert?.work_type, WORK_TYPE_VALUES),
    employment_type: nullableEnum(alert?.employment_type, EMPLOYMENT_TYPE_VALUES),
    frequency: FREQUENCY_VALUES.has(alert?.frequency) ? alert.frequency : 'daily',
  }
}

export function jobAlertPayload(values) {
  return {
    keyword: String(values.keyword || '').trim(),
    keyword_scope: SCOPE_VALUES.has(values.keyword_scope) ? values.keyword_scope : 'title',
    category_ids: categoryIds(values.category_ids),
    province_id: nullableId(values.province_id),
    ward_id: nullableId(values.ward_id),
    salary_bucket: nullableEnum(values.salary_bucket, SALARY_VALUES),
    experience_years: nullableEnum(values.experience_years, EXPERIENCE_VALUES),
    work_type: nullableEnum(values.work_type, WORK_TYPE_VALUES),
    employment_type: nullableEnum(values.employment_type, EMPLOYMENT_TYPE_VALUES),
    frequency: FREQUENCY_VALUES.has(values.frequency) ? values.frequency : 'daily',
  }
}

export function jobAlertPrefillFromSearchParams(searchParams) {
  return jobAlertFormValues({
    keyword: searchParams.get('keyword') || '',
    keyword_scope: searchParams.get('keyword_scope'),
    category_ids: (searchParams.get('category_ids') || '').split(',').filter(Boolean),
    province_id: searchParams.get('province_id'),
    ward_id: searchParams.get('ward_id'),
    salary_bucket: searchParams.get('salary_bucket'),
    experience_years: searchParams.get('experience_years'),
    work_type: searchParams.get('work_type'),
    employment_type: searchParams.get('employment_type'),
    frequency: searchParams.get('frequency'),
  })
}

export function jobAlertErrorCode(error) {
  const data = error?.response?.data
  return data?.code || data?.detail?.code || ''
}

export function jobAlertResultsPath(alert) {
  const params = new URLSearchParams()
  const selectedCategoryIds = categoryIds(
    alert?.category_ids ?? alert?.categories?.map(({ id }) => id),
  )
  const provinceId = nullableId(alert?.province_id ?? alert?.province?.id)
  const wardId = nullableId(alert?.ward_id ?? alert?.ward?.id)

  if (alert?.keyword?.trim()) params.set('search', alert.keyword.trim())
  if (['company', 'both'].includes(alert?.keyword_scope)) {
    params.set('search_by', alert.keyword_scope)
  }
  if (selectedCategoryIds.length) params.set('cat', selectedCategoryIds.join(','))
  if (wardId || provinceId) params.set('locations', String(wardId || provinceId))
  if (SALARY_VALUES.has(alert?.salary_bucket)) {
    const salaryParam = { u10: '-10', o50: '50-' }[alert.salary_bucket] || alert.salary_bucket
    params.set('salary', salaryParam)
  }
  if (EXPERIENCE_VALUES.has(alert?.experience_years)) params.set('exp', alert.experience_years)
  if (WORK_TYPE_VALUES.has(alert?.work_type)) params.set('wt', alert.work_type)
  if (EMPLOYMENT_TYPE_VALUES.has(alert?.employment_type)) params.set('et', alert.employment_type)

  const query = params.toString()
  return query ? `/viec-lam?${query}` : '/viec-lam'
}

export function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label || ''
}

const VIETNAM_DELIVERY_FORMATTER = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function formatJobAlertDelivery(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(
    VIETNAM_DELIVERY_FORMATTER.formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value: partValue }) => [type, partValue]),
  )
  return `${parts.day}/${parts.month}/${parts.year} lúc ${parts.hour}:${parts.minute}`
}
