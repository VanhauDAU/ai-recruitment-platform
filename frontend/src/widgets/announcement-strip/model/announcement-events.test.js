import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  flushAnnouncementEvents,
  queueAnnouncementEvent,
  resetAnnouncementEventsForTests,
} from './announcement-events'

const { sendAnnouncementEvents } = vi.hoisted(() => ({
  sendAnnouncementEvents: vi.fn(),
}))

vi.mock('@/entities/announcement', () => ({ sendAnnouncementEvents }))

const REMOTE = {
  id: 'ann_remote',
  revision: 3,
  source: 'remote',
}

describe('announcement event batcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    resetAnnouncementEventsForTests()
    sendAnnouncementEvents.mockResolvedValue(undefined)
  })

  it('deduplicates a short burst and sends one best-effort batch', async () => {
    queueAnnouncementEvent(REMOTE, 'candidate', 'impression')
    queueAnnouncementEvent(REMOTE, 'candidate', 'impression')
    queueAnnouncementEvent(REMOTE, 'candidate', 'click')

    await vi.advanceTimersByTimeAsync(400)

    expect(sendAnnouncementEvents).toHaveBeenCalledWith([
      {
        public_id: 'ann_remote',
        revision: 3,
        surface: 'candidate',
        event: 'impression',
      },
      {
        public_id: 'ann_remote',
        revision: 3,
        surface: 'candidate',
        event: 'click',
      },
    ])
  })

  it('ignores system labels and never retries a rejected request', async () => {
    sendAnnouncementEvents.mockRejectedValue(new Error('network down'))
    queueAnnouncementEvent({ ...REMOTE, source: 'system' }, 'candidate', 'impression')
    flushAnnouncementEvents()
    expect(sendAnnouncementEvents).not.toHaveBeenCalled()

    queueAnnouncementEvent(REMOTE, 'candidate', 'dismiss')
    await vi.advanceTimersByTimeAsync(400)
    await Promise.resolve()

    expect(sendAnnouncementEvents).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(sendAnnouncementEvents).toHaveBeenCalledTimes(1)
  })
})
