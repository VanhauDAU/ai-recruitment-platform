const SEARCH_SIGNAL_CODES = new Set(['category', 'position'])

export function recommendationReasons(job) {
  const explicit = Array.isArray(job?.match_reasons)
    ? job.match_reasons.map((reason) => String(reason || '').trim()).filter(Boolean)
    : []
  if (explicit.length) return [...new Set(explicit)]

  const codes = new Set((job?.match_details || []).map((detail) => detail.code))
  const reasons = []
  if ([...SEARCH_SIGNAL_CODES].some((code) => codes.has(code))) {
    reasons.push('Phù hợp với tìm kiếm của bạn')
  }
  if (codes.has('skills')) reasons.push('Phù hợp với kỹ năng của bạn')
  return reasons
}

export function groupRecommendationJobs(jobs = [], size = 4) {
  const bounded = jobs.slice(0, 8)
  const groups = []
  for (let index = 0; index < bounded.length; index += size) {
    groups.push(bounded.slice(index, index + size))
  }
  return groups
}
