import { SALARY_RANGES } from '@/entities/job'
import { getCommaList, getLocationIds } from './job-list-params'

const SALARY_BUCKETS = new Set(SALARY_RANGES.map((range) => range.key))
const SALARY_PARAM_TO_BUCKET = {
  '-10': 'u10',
  '50-': 'o50',
}
const KEYWORD_SCOPES = new Set(['title', 'company', 'both'])

export function buildJobAlertPrefill({ provinces = [], searchParams, selectedLocationGroups = [] }) {
  const values = { keyword_scope: 'title', frequency: 'daily' }
  const skippedMultiFields = []
  const keyword = searchParams.get('search')?.trim()
  const scope = searchParams.get('search_by')
  const categories = getCommaList(searchParams, 'cat')
  const locations = getLocationIds(searchParams)
  const experience = getCommaList(searchParams, 'exp')
  const salary = searchParams.get('salary')

  if (keyword) values.keyword = keyword
  if (KEYWORD_SCOPES.has(scope)) values.keyword_scope = scope
  if (categories.length) {
    values.category_ids = [...new Set(categories.map(Number).filter(Number.isInteger))]
  }
  if (experience.length === 1) values.experience_years = experience[0]
  else if (experience.length > 1) skippedMultiFields.push('Kinh nghiệm')
  if (SALARY_BUCKETS.has(salary)) values.salary_bucket = salary
  else if (SALARY_PARAM_TO_BUCKET[salary]) values.salary_bucket = SALARY_PARAM_TO_BUCKET[salary]
  if (searchParams.get('wt')) values.work_type = searchParams.get('wt')
  if (searchParams.get('et')) values.employment_type = searchParams.get('et')

  if (locations.length === 1) {
    const locationId = locations[0]
    const province = provinces.find((item) => item.id === locationId)
    if (province) {
      values.province_id = province.id
    } else {
      const group = selectedLocationGroups.find(({ wards }) => wards.some((ward) => ward.id === locationId))
      if (group?.province) {
        values.province_id = group.province.id
        values.ward_id = locationId
      }
    }
  } else if (locations.length > 1) {
    skippedMultiFields.push('Địa điểm')
  }

  if (skippedMultiFields.length) {
    values.prefillNotice = `Các bộ lọc chọn nhiều giá trị (${skippedMultiFields.join(', ')}) chưa được điền sẵn. Mỗi thông báo chỉ hỗ trợ một giá trị cho các trường này; vui lòng chọn lại trong biểu mẫu.`
  }

  return values
}
