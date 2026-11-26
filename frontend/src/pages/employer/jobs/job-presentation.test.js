import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import {
  applicationFilterChips,
  applicationFilterParams,
  deadlineBounds,
  formatRelativeDay,
  publicJobUrl,
} from './job-detail-presentation'
import {
  employerJobApplicationsPath,
  formatApplyRate,
  jobDeadlineMeta,
  jobStatusMeta,
} from './job-list-presentation'

const NOW = dayjs('2026-11-15T10:00:00')

describe('job list presentation', () => {
  it('describes the deadline of every lifecycle state', () => {
    expect(jobDeadlineMeta({ status: 'draft', deadline: null }, NOW)).toMatchObject({ date: null, hint: 'Chưa đăng tin', progress: null })
    expect(jobDeadlineMeta({ status: 'closed', deadline: '2026-10-30' }, NOW)).toMatchObject({ date: '30/10/2026', hint: 'Đã ngừng tuyển' })
    expect(jobDeadlineMeta({ status: 'active', is_expired: true, deadline: '2026-11-05' }, NOW).hint).toBe('Đã hết hạn')
    expect(jobDeadlineMeta({ status: 'active', deadline: null }, NOW).hint).toBe('Không giới hạn')
  })

  it('counts down an open job, escalates the tone and reports elapsed time', () => {
    const job = { status: 'active', first_approved_at: '2026-11-05T02:00:00Z', deadline: '2026-11-25' }
    const open = jobDeadlineMeta(job, NOW)
    expect(open).toMatchObject({ hint: 'Còn 10 ngày', progress: 50 })
    expect(open.tone.text).toBe('text-slate-500')
    expect(jobDeadlineMeta({ ...job, deadline: '2026-11-18' }, NOW).tone.text).toBe('text-red-600')
    expect(jobDeadlineMeta({ ...job, deadline: '2026-11-15' }, NOW).hint).toBe('Hết hạn hôm nay')
  })

  it('counts down to the end of the display window when it comes before the deadline', () => {
    const job = { status: 'active', deadline: null, closes_on: '2026-11-20' }
    expect(jobDeadlineMeta(job, NOW)).toMatchObject({ date: '20/11/2026', hint: 'Còn 5 ngày', windowEnds: true })
    expect(jobDeadlineMeta({ ...job, deadline: '2026-11-20' }, NOW).windowEnds).toBe(false)
  })

  it('formats the apply rate only when the job has views and applicants', () => {
    expect(formatApplyRate(3, 128)).toBe('2,3%')
    expect(formatApplyRate(0, 128)).toBeNull()
    expect(formatApplyRate(3, 0)).toBeNull()
    expect(formatApplyRate(5, 2)).toBe('100%')
  })

  it('labels a held active job as hidden and links to filtered applications', () => {
    expect(jobStatusMeta({ status: 'active', effective_state: 'hidden' }).label).toBe('Bị ẩn')
    expect(jobStatusMeta({ status: 'active', effective_state: 'expired' }).label).toBe('Hết hạn')
    expect(employerJobApplicationsPath({ public_id: 'jb_1' }, { scope: 'unread' }))
      .toBe('/tuyendung/app/ho-so-ung-tuyen?job=jb_1&scope=unread')
  })
})

describe('job detail presentation', () => {
  const summary = { total: 6, unanswered: 3, by_status: { submitted: 2, shortlisted: 4 } }

  it('hides empty status chips unless the filter selects them', () => {
    expect(applicationFilterChips(summary, 'all').map((chip) => chip.key))
      .toEqual(['all', 'unanswered', 'submitted', 'shortlisted'])
    expect(applicationFilterChips(summary, 'rejected').map((chip) => chip.key)).toContain('rejected')
  })

  it('maps chip keys onto the recruiter applications API', () => {
    expect(applicationFilterParams('all')).toEqual({})
    expect(applicationFilterParams('unanswered')).toEqual({ scope: 'unanswered' })
    expect(applicationFilterParams('interviewed')).toEqual({ status: 'interviewed' })
    expect(applicationFilterParams('unknown')).toEqual({})
  })

  it('formats recent application dates relatively', () => {
    expect(formatRelativeDay('2026-11-15T01:00:00', NOW)).toBe('Hôm nay')
    expect(formatRelativeDay('2026-11-14T23:00:00', NOW)).toBe('Hôm qua')
    expect(formatRelativeDay('2026-11-11T09:00:00', NOW)).toBe('4 ngày trước')
    expect(formatRelativeDay('2026-11-01T09:00:00', NOW)).toBe('01/11/2026')
    expect(formatRelativeDay(null, NOW)).toBe('—')
  })

  it('links the public page only while candidates can see the job', () => {
    expect(publicJobUrl({ effective_state: 'active', slug: 'ky-su' })).toBe('/viec-lam/ky-su')
    expect(publicJobUrl({ effective_state: 'expired', slug: 'ky-su' })).toBeNull()
    expect(publicJobUrl({ effective_state: 'hidden', slug: 'ky-su' })).toBeNull()
    expect(publicJobUrl({ effective_state: 'draft', slug: 'ky-su' })).toBeNull()
  })

  it('bounds an extension by the current deadline, public lifetime and visibility end', () => {
    const policy = { max_deadline_days: 90, max_public_lifetime_days: 60 }
    const today = dayjs('2026-11-15')
    const job = { deadline: '2026-11-10', first_approved_at: '2026-10-01T00:00:00Z' }

    const extend = deadlineBounds(job, 'extend', policy, today)
    expect(extend.earliest.format('YYYY-MM-DD')).toBe('2026-11-10')
    expect(extend.latest.format('YYYY-MM-DD')).toBe('2026-11-30')

    const reopen = deadlineBounds(job, 'reopen', policy, today)
    expect(reopen.earliest.format('YYYY-MM-DD')).toBe('2026-11-15')
    expect(reopen.latest.format('YYYY-MM-DD')).toBe('2027-02-13')

    const visible = deadlineBounds({ ...job, visibility_ends_at: '2026-11-20T00:00:00Z' }, 'reopen', policy, today)
    expect(visible.latest.format('YYYY-MM-DD')).toBe('2026-11-20')
  })
})
