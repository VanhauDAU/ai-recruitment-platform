import { describe, expect, it } from 'vitest'
import {
  interviewModeLabel,
  interviewStatusTag,
  lockedReasonText,
  messagePreview,
  systemMessageText,
} from './message-labels'

describe('interviewStatusTag', () => {
  it('reads an accepted interview whose time is over as having taken place', () => {
    expect(interviewStatusTag('accepted')).toEqual({ label: 'Đã nhận', tone: 'accent' })
    expect(interviewStatusTag('accepted', { ended: true })).toEqual({ label: 'Đã diễn ra', tone: 'fog' })
    expect(interviewStatusTag('cancelled', { ended: true }).tone).toBe('danger')
  })
})

describe('messagePreview', () => {
  it('collapses text whitespace and labels the other kinds', () => {
    expect(messagePreview(null)).toBe('')
    expect(messagePreview({ kind: 'text', body: 'Xin   chào\nbạn' })).toBe('Xin chào bạn')
    expect(messagePreview({ kind: 'text', preview: 'Tóm tắt', body: 'dài' })).toBe('Tóm tắt')
    expect(messagePreview({ kind: 'cv' })).toBe('Đã gửi một CV')
    expect(messagePreview({ kind: 'image' })).toBe('Đã gửi một ảnh')
    expect(messagePreview({ kind: 'unknown' })).toBe('Thông báo hệ thống')
  })

  it('prefixes the viewer own messages', () => {
    const message = { kind: 'job', sender_role: 'recruiter' }
    expect(messagePreview(message, { myRole: 'recruiter' })).toBe('Bạn: Đã gửi một tin tuyển dụng')
    expect(messagePreview(message, { myRole: 'candidate' })).toBe('Đã gửi một tin tuyển dụng')
  })
})

describe('lockedReasonText and interviewModeLabel', () => {
  it('falls back to the generic reason and to the raw mode', () => {
    expect(lockedReasonText('blocked')).toBe('Ứng viên đang bị công ty chặn nên không gửi được tin.')
    expect(lockedReasonText('whatever')).toBe('Cuộc trò chuyện hiện không nhận tin nhắn.')
    expect(interviewModeLabel('onsite')).toBe('Trực tiếp')
    expect(interviewModeLabel('carrier-pigeon')).toBe('carrier-pigeon')
    expect(interviewModeLabel(undefined)).toBe('')
  })

  it('shows an unknown interview status as its code', () => {
    expect(interviewStatusTag('proposed')).toEqual({ label: 'Chờ phản hồi', tone: 'fog' })
    expect(interviewStatusTag('mystery')).toEqual({ label: 'mystery', tone: 'fog' })
  })
})

describe('systemMessageText', () => {
  it('names the actor from the viewer side', () => {
    const cancelled = { system: { event: 'interview_cancelled', actor_role: 'recruiter' } }
    expect(systemMessageText(cancelled, 'recruiter')).toBe('Bạn đã hủy lịch phỏng vấn')
    expect(systemMessageText(cancelled, 'candidate')).toBe('Nhà tuyển dụng đã hủy lịch phỏng vấn')
    expect(systemMessageText({ system: { event: 'interview_accepted', actor_role: 'candidate' } }, 'recruiter'))
      .toBe('Ứng viên đã chấp nhận lịch phỏng vấn')
    expect(systemMessageText({ system: { event: 'started' } }, 'candidate')).toBe('Cuộc trò chuyện đã bắt đầu')
  })

  it('falls back to the body, then to a generic label', () => {
    expect(systemMessageText({ system: { event: 'other' }, body: 'Ghi chú' }, 'candidate')).toBe('Ghi chú')
    expect(systemMessageText({}, 'candidate')).toBe('Thông báo hệ thống')
  })
})
