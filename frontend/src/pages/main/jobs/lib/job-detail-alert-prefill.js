import { SALARY_RANGES } from '@/entities/job'

function positiveId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function uniqueIds(values) {
  return [...new Set(values.map(positiveId).filter(Boolean))]
}

function keywordFromJob(job) {
  const value = [
    job?.primary_specialization?.name,
    job?.category_name,
    job?.title,
  ].find((candidate) => String(candidate || '').trim())

  return String(value || '').trim().slice(0, 255).trim()
}

function categoryIdsFromJob(job) {
  const categoryId = positiveId(job?.primary_specialization?.id ?? job?.category)
  return categoryId ? [categoryId] : []
}

function locationPrefill(job) {
  const workplaceGroups = Array.isArray(job?.workplace_groups) ? job.workplace_groups : []
  const provinceIds = uniqueIds([
    ...workplaceGroups.map(({ province_id: provinceId }) => provinceId),
    ...(job?.locations_detail || []).map(({ id }) => id),
  ])

  if (provinceIds.length > 1) {
    return {
      prefillNotice: 'Tin tuyển dụng có nhiều tỉnh/thành. Địa điểm chưa được điền sẵn để tránh chọn thay bạn; vui lòng chọn nơi bạn muốn nhận thông báo.',
    }
  }
  if (provinceIds.length !== 1) return {}

  const provinceId = provinceIds[0]
  const addresses = workplaceGroups
    .filter((group) => positiveId(group.province_id) === provinceId)
    .flatMap((group) => Array.isArray(group.addresses) ? group.addresses : [])
  const wardIds = uniqueIds(addresses.map(({ ward_id: wardId }) => wardId))
  const includesProvinceWideLocation = addresses.some(({ ward_id: wardId }) => !positiveId(wardId))

  return {
    province_id: provinceId,
    ...(!includesProvinceWideLocation && wardIds.length === 1 ? { ward_id: wardIds[0] } : {}),
  }
}

function exactSalaryBucket(job) {
  if (job?.currency !== 'VND' || job?.salary_type === 'negotiable') return null

  const salaryMin = job?.salary_min == null ? null : Number(job.salary_min)
  const salaryMax = job?.salary_max == null ? null : Number(job.salary_max)
  if ((salaryMin !== null && !Number.isFinite(salaryMin))
    || (salaryMax !== null && !Number.isFinite(salaryMax))) return null

  return SALARY_RANGES.find(({ gte = null, lte = null }) => {
    if (gte === null) {
      return job.salary_type === 'up_to' && salaryMin === null && salaryMax === lte
    }
    if (lte === null) {
      return job.salary_type === 'from' && salaryMin === gte && salaryMax === null
    }
    return job.salary_type === 'range' && salaryMin === gte && salaryMax === lte
  })?.key || null
}

export function buildJobDetailAlertPrefill(job) {
  const values = {
    keyword: keywordFromJob(job),
    keyword_scope: 'title',
    category_ids: categoryIdsFromJob(job),
    frequency: 'daily',
    ...locationPrefill(job),
  }
  const salaryBucket = exactSalaryBucket(job)

  if (salaryBucket) values.salary_bucket = salaryBucket
  if (job?.experience_years) values.experience_years = job.experience_years
  if (job?.work_type) values.work_type = job.work_type
  if (job?.employment_type) values.employment_type = job.employment_type

  return values
}

