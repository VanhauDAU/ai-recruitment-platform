import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runAdminAnnouncementAction } from './admin-announcement.api'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { post } }))

describe('admin announcement lifecycle actions', () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue({
      data: {
        public_id: 'ann_1',
        internal_name: 'Bảo trì',
        lifecycle_state: 'published',
        revision_token: 5,
        dismissal_version: 2,
        revisions: [],
        audit_events: [],
      },
    })
  })

  it.each(['publish', 'pause', 'resume', 'archive', 'reset-dismissals'])(
    'posts %s to its own endpoint with the optimistic lock',
    async (action) => {
      await runAdminAnnouncementAction('ann_1', action, { revision_token: 4 })

      expect(post).toHaveBeenCalledWith(
        `/site/admin/announcements/ann_1/${action}/`,
        { revision_token: 4 },
      )
    },
  )

  it('exposes the dismissal version so the drawer can show it', async () => {
    const detail = await runAdminAnnouncementAction('ann_1', 'reset-dismissals', {
      revision_token: 4,
    })

    expect(detail.dismissal_version).toBe(2)
  })
})
