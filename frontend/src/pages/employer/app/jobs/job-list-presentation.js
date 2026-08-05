import dayjs from 'dayjs'
import { employerAppPath } from '@/shared/config/portals'

export const JOB_STATUS_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'active', label: 'Đang tuyển' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'draft', label: 'Nháp' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'closed', label: 'Đã đóng' },
]

const STATUS_META = {
  active: { label: 'Đang tuyển', className: 'text-emerald-700', dot: 'bg-emerald-500' },
  pending: { label: 'Chờ duyệt', className: 'text-amber-700', dot: 'bg-amber-500' },
  draft: { label: 'Nháp', className: 'text-slate-500', dot: 'bg-slate-400' },
  rejected: { label: 'Từ chối', className: 'text-rose-700', dot: 'bg-rose-500' },
  expired: { label: 'Hết hạn', className: 'text-orange-700', dot: 'bg-orange-500' },
  closed: { label: 'Đã đóng', className: 'text-slate-500', dot: 'bg-slate-400' },
}

export function jobStatusMeta(job) {
  return STATUS_META[job.is_expired ? 'expired' : job.status]
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
