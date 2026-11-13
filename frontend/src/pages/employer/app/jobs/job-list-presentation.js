import dayjs from 'dayjs'
import { employerAppPath } from '@/shared/config/portals'

export const JOB_STATUS_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'active', label: 'Đang tuyển' },
  { value: 'draft', label: 'Nháp' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'closed', label: 'Đã đóng' },
]

const STATUS_META = {
  held: { label: 'Tạm ẩn', className: 'text-red-700', dot: 'bg-red-500' },
  active: { label: 'Đang tuyển', className: 'text-emerald-700', dot: 'bg-emerald-500' },
  draft: { label: 'Nháp', className: 'text-slate-500', dot: 'bg-slate-400' },
  expired: { label: 'Hết hạn', className: 'text-orange-700', dot: 'bg-orange-500' },
  closed: { label: 'Đã đóng', className: 'text-slate-500', dot: 'bg-slate-400' },
}

// A held job stays `active` for the business flow but candidates cannot see it.
export function isJobHeld(job) {
  return Boolean(job.visibility_hold)
}

function jobStatusKey(job) {
  if (job.status === 'active' && isJobHeld(job)) return 'held'
  return job.is_expired ? 'expired' : job.status
}

export function jobStatusMeta(job) {
  return STATUS_META[jobStatusKey(job)]
    || { label: job.status || 'Không xác định', className: 'text-slate-500', dot: 'bg-slate-400' }
}

export function formatJobDate(value) {
  if (!value) return '—'
  const date = dayjs(value)
  return date.isValid() ? date.format('DD/MM/YYYY') : '—'
}

export function candidateInitials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  return words.slice(-2).map((word) => word.charAt(0)).join('').toUpperCase() || 'UV'
}

export function employerJobApplicationsPath(job, application) {
  const params = new URLSearchParams({ job: job.public_id })
  if (application?.application_public_id) {
    params.set('application', application.application_public_id)
  }
  return employerAppPath(`/applications?${params}`)
}
