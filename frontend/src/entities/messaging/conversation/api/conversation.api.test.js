// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelInterview,
  clearConversation,
  downloadMessageCvExport,
  getConnectAppliedJobs,
  getConversation,
  getConversationMessages,
  getConversations,
  getConversationUnreadCount,
  getMessageCvExport,
  getMessageFile,
  getShareableCvs,
  getShareableJobs,
  markConversationRead,
  requestMessageCvExport,
  respondToInterview,
  scheduleInterview,
  sendConversationMessage,
  setConversationBlocked,
  startConversation,
} from './conversation.api'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, post } }))

describe('conversation API', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { ok: true } })
    post.mockReset().mockResolvedValue({ data: { ok: true } })
  })

  it('scopes conversation reads to the caller portal and drops an empty search', async () => {
    await expect(getConversations('candidate')).resolves.toEqual({ ok: true })
    expect(get).toHaveBeenLastCalledWith('/candidate/conversations/', { params: { q: undefined, page: 1 } })

    await getConversations('employer', { q: 'java', page: 2 })
    expect(get).toHaveBeenLastCalledWith('/employer/conversations/', { params: { q: 'java', page: 2 } })

    await getConversationUnreadCount('employer')
    expect(get).toHaveBeenLastCalledWith('/employer/conversations/unread-count/')

    await getConversation('candidate', 'cv_1')
    expect(get).toHaveBeenLastCalledWith('/candidate/conversations/cv_1/')

    await getConversationMessages('candidate', 'cv_1', { before: 40 })
    expect(get).toHaveBeenLastCalledWith('/candidate/conversations/cv_1/messages/', {
      params: { before: 40, after: undefined, limit: 30 },
    })
  })

  it('sends JSON messages as is and files as multipart with the client id', async () => {
    await sendConversationMessage('employer', 'cv_1', { client_id: 'c1', text: 'Chào bạn' })
    expect(post).toHaveBeenLastCalledWith('/employer/conversations/cv_1/messages/', { client_id: 'c1', text: 'Chào bạn' })

    const file = new Blob(['%PDF'], { type: 'application/pdf' })
    await sendConversationMessage('candidate', 'cv_1', { client_id: 'c2', file })
    const [url, form] = post.mock.lastCall
    expect(url).toBe('/candidate/conversations/cv_1/messages/')
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('client_id')).toBe('c2')
    expect(form.get('file')).toBeInstanceOf(Blob)
  })

  it('starts, reads, clears and blocks a conversation', async () => {
    await startConversation('employer', { application: 'app_1' })
    expect(post).toHaveBeenLastCalledWith('/employer/conversations/', { application: 'app_1' })

    await expect(markConversationRead('candidate', 'cv_1', 12)).resolves.toBeUndefined()
    expect(post).toHaveBeenLastCalledWith('/candidate/conversations/cv_1/read/', { seq: 12 })

    await clearConversation('candidate', 'cv_1')
    expect(post).toHaveBeenLastCalledWith('/candidate/conversations/cv_1/clear/')

    await setConversationBlocked('employer', 'cv_1', true)
    expect(post).toHaveBeenLastCalledWith('/employer/conversations/cv_1/block/', { blocked: true })
  })

  it('streams message files as blobs and asks for a download only when requested', async () => {
    await getMessageFile('candidate', 'cv_1', 'msg_1')
    expect(get).toHaveBeenLastCalledWith('/candidate/conversations/cv_1/messages/msg_1/file/', {
      params: undefined,
      responseType: 'blob',
    })

    await getMessageFile('employer', 'cv_1', 'msg_1', { download: true })
    expect(get.mock.lastCall[1].params).toEqual({ download: 1 })
  })

  it('exports a shared CV from the employer side', async () => {
    await requestMessageCvExport('cv_1', 'msg_1')
    expect(post).toHaveBeenLastCalledWith('/employer/conversations/cv_1/messages/msg_1/cv-export/')

    await getMessageCvExport('cv_1', 'msg_1', 'exp_1')
    expect(get).toHaveBeenLastCalledWith('/employer/conversations/cv_1/messages/msg_1/cv-export/exp_1/')

    await downloadMessageCvExport('/api/employer/exports/exp_1/download/')
    expect(get).toHaveBeenLastCalledWith('/api/employer/exports/exp_1/download/', { responseType: 'blob' })
  })

  it('lists what each side can share', async () => {
    await getConnectAppliedJobs()
    expect(get).toHaveBeenLastCalledWith('/candidate/conversations/applied-jobs/')
    await getShareableCvs()
    expect(get).toHaveBeenLastCalledWith('/candidate/conversations/shareable-cvs/')
    await getShareableJobs()
    expect(get).toHaveBeenLastCalledWith('/employer/conversations/shareable-jobs/')
  })

  it('schedules, cancels and answers interviews, sending a note only when given', async () => {
    await scheduleInterview('cv_1', { starts_at: '2026-12-01T09:00:00+07:00', mode: 'online' })
    expect(post).toHaveBeenLastCalledWith('/employer/conversations/cv_1/interviews/', {
      starts_at: '2026-12-01T09:00:00+07:00',
      mode: 'online',
    })

    await cancelInterview('iv_1')
    expect(post).toHaveBeenLastCalledWith('/employer/interviews/iv_1/cancel/', {})
    await cancelInterview('iv_1', 'Đổi lịch')
    expect(post).toHaveBeenLastCalledWith('/employer/interviews/iv_1/cancel/', { note: 'Đổi lịch' })

    await respondToInterview('iv_1', { action: 'accept' })
    expect(post).toHaveBeenLastCalledWith('/candidate/interviews/iv_1/respond/', { action: 'accept' })
    await respondToInterview('iv_1', { action: 'reschedule', note: 'Chiều thứ Sáu' })
    expect(post).toHaveBeenLastCalledWith('/candidate/interviews/iv_1/respond/', {
      action: 'reschedule',
      note: 'Chiều thứ Sáu',
    })
  })
})
