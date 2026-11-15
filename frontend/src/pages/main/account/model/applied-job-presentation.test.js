import { describe, expect, it } from 'vitest'
import {
  APPLICATION_STAGES,
  buildApplicationTimeline,
  getApplicationHeadline,
  getCompletedStageCount,
} from './applied-job-presentation'

const submitted = { status: 'submitted', label: 'Đã nộp hồ sơ', occurred_at: '2026-11-01T02:00:00Z' }
const viewed = { status: 'viewed', label: 'Nhà tuyển dụng đã xem hồ sơ', occurred_at: '2026-11-02T02:00:00Z' }
const reminder = { status: 'reminder', label: 'ProCV đã nhắc nhà tuyển dụng phản hồi CV của bạn', occurred_at: '2026-11-05T02:00:00Z' }

describe('applied job presentation', () => {
  it('says the employer stopped recruiting while the application waited, with the time it stopped', () => {
    const application = { status: 'viewed', job_stopped_at: '2026-11-13T07:04:00Z', timeline: [viewed, submitted] }

    expect(getApplicationHeadline(application)).toMatchObject({ tone: 'muted', text: 'NTD ngừng tuyển vị trí này' })
    expect(getApplicationHeadline(application).time).toMatch(/^13-11-2026 \d{2}:04$/)
    expect(getCompletedStageCount(application)).toBe(APPLICATION_STAGES.length)
    expect(buildApplicationTimeline(application).map((item) => item.status)).toEqual(['stopped', 'viewed', 'submitted'])
  })

  it('keeps the answer when the job stopped after the employer decided', () => {
    const rejected = { status: 'rejected', label: 'Chưa phù hợp', occurred_at: '2026-11-03T02:00:00Z' }
    const application = { status: 'rejected', job_stopped_at: '2026-11-10T02:00:00Z', timeline: [rejected, viewed, submitted] }

    expect(getApplicationHeadline(application)).toMatchObject({ tone: 'muted', text: 'Chưa phù hợp' })
    expect(buildApplicationTimeline(application)[0].status).toBe('stopped')
  })

  it('shows whichever came last between a withdrawal and the job stopping', () => {
    const withdrawn = { status: 'withdrawn', label: 'Bạn đã rút hồ sơ', occurred_at: '2026-11-03T02:00:00Z' }
    const application = { status: 'withdrawn', timeline: [withdrawn, submitted] }

    expect(getApplicationHeadline({ ...application, job_stopped_at: '2026-11-04T02:00:00Z' }).text)
      .toBe('NTD ngừng tuyển vị trí này')
    expect(getApplicationHeadline({ ...application, job_stopped_at: '2026-11-02T02:00:00Z' }).text)
      .toBe('Bạn đã rút hồ sơ')
  })

  it('tells the candidate ProCV reminded the employer, depending on whether the CV was seen', () => {
    expect(getApplicationHeadline({ status: 'viewed', timeline: [reminder, viewed, submitted] })).toEqual({
      tone: 'info', text: 'NTD đã xem CV. ProCV đã nhắc NTD phản hồi CV của bạn', time: '05-11-2026',
    })
    expect(getApplicationHeadline({ status: 'submitted', timeline: [reminder, submitted] }).text)
      .toBe('ProCV đã nhắc NTD xem CV của bạn')
  })

  it('completes the stages each status reached, keeping progress after a withdrawal', () => {
    expect(getCompletedStageCount({ status: 'submitted', timeline: [submitted] })).toBe(2)
    expect(getCompletedStageCount({ status: 'viewed', timeline: [viewed, submitted] })).toBe(3)
    expect(getCompletedStageCount({ status: 'shortlisted', timeline: [] })).toBe(4)
    expect(getCompletedStageCount({ status: 'rejected', timeline: [] })).toBe(5)
    expect(getCompletedStageCount({
      status: 'withdrawn', timeline: [{ status: 'withdrawn' }, viewed, submitted],
    })).toBe(3)
  })
})
