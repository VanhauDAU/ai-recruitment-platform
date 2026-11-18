import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getActiveAnnouncements } from './announcement.api'

const { get, post } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/shared/api/client', () => ({ default: { get, post } }))

describe('announcement runtime API', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset().mockResolvedValue({ data: { accepted: true } })
  })

  it('reports only an enum when the remote contract drops malformed items', async () => {
    get.mockResolvedValue({
      data: {
        remote_enabled: true,
        items: [
          {
            public_id: 'ann_valid',
            message: 'Thông báo hợp lệ.',
            dismiss: { mode: 'locked', version: 1 },
          },
          { public_id: '', message: 'Thiếu public id.' },
        ],
        next_transition_at: null,
      },
    })

    await expect(getActiveAnnouncements({
      locale: 'vi',
      path: '/',
      surface: 'candidate',
    })).resolves.toMatchObject({
      remoteEnabled: true,
      items: [{ id: 'ann_valid' }],
    })
    expect(post).toHaveBeenCalledWith('/site/announcements/runtime-events/', {
      surface: 'candidate',
      event: 'contract_error',
      reason: 'contract',
    })
  })

  it('drops every remote item without telemetry when the kill switch is false', async () => {
    get.mockResolvedValue({
      data: {
        remote_enabled: false,
        items: [{
          public_id: 'ann_stale',
          message: 'Không được hiển thị.',
        }],
        next_transition_at: null,
      },
    })

    await expect(getActiveAnnouncements({
      locale: 'vi',
      path: '/',
      surface: 'candidate',
    })).resolves.toMatchObject({
      remoteEnabled: false,
      items: [],
    })
    expect(post).not.toHaveBeenCalled()
  })
})
