const DAY_IN_MS = 86_400_000

export function getJobPostedAt(job = {}) {
  return job.first_approved_at || job.published_at || job.created_at || null
}

export function formatJobPostedLabel(job, now = Date.now()) {
  const postedAt = getJobPostedAt(job)
  if (!postedAt) return null

  const postedTimestamp = new Date(postedAt).getTime()
  if (Number.isNaN(postedTimestamp)) return null

  const days = Math.floor((now - postedTimestamp) / DAY_IN_MS)
  if (days <= 0) return 'Đăng hôm nay'
  if (days < 7) return `Đăng ${days} ngày trước`
  if (days < 30) return `Đăng ${Math.floor(days / 7)} tuần trước`
  return `Đăng ${Math.floor(days / 30)} tháng trước`
}
