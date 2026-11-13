export const JOB_LOGO_TINTS = [
  ['#e6f0ff', '#2563eb'],
  ['#eafaf1', '#16a34a'],
  ['#fff1e6', '#ea580c'],
  ['#fdeaf1', '#db2777'],
  ['#f0edfb', '#7c3aed'],
  ['#fff7e0', '#ca8a04'],
]

const CARD_TONE_CLASSES = {
  neutral: 'border-slate-200 bg-white',
  orange: 'border-amber-200/80 bg-gradient-to-br from-white via-amber-50/25 to-orange-50/40',
  green: 'border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/25 to-teal-50/40',
  green_strong: 'border-emerald-300/80 bg-gradient-to-br from-white via-emerald-50/40 to-green-100/35',
}

export function resolveJobPresentation(job = {}) {
  if (job.presentation) return job.presentation

  const sponsored = job.tier === 'featured' || job.tier === 'top'
  const labels = []
  if (sponsored) labels.push({ code: 'sponsored', text: 'Tài trợ', tone: 'sponsored' })
  if (job.is_hot) labels.push({ code: 'hot', text: 'HOT', tone: 'danger' })
  if (job.is_urgent) labels.push({ code: 'urgent', text: 'GẤP', tone: 'warning' })
  if (job.has_flash_badge) {
    labels.push({ code: 'fast_response', text: 'Phản hồi nhanh', tone: 'success' })
  }
  return {
    sponsored,
    card_tone: job.tier === 'top' ? 'green' : job.tier === 'featured' ? 'orange' : 'neutral',
    labels,
    display_reason: '',
    active_until: job.visibility_ends_at || null,
    placement: sponsored ? 'legacy_priority' : 'organic',
  }
}

export function jobCardToneClass(job) {
  const tone = resolveJobPresentation(job).card_tone
  return CARD_TONE_CLASSES[tone] || CARD_TONE_CLASSES.neutral
}
