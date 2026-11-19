import { describe, expect, it } from 'vitest'
import { getAnnouncementStaleConflict } from './use-announcement-actions'

describe('announcement stale conflict', () => {
  it('extracts only the canonical 409 contract', () => {
    expect(getAnnouncementStaleConflict({
      response: {
        status: 409,
        data: {
          code: 'announcement_revision_stale',
          detail: 'Dữ liệu mới hơn.',
          current_revision_token: 8,
        },
      },
    })).toEqual({
      detail: 'Dữ liệu mới hơn.',
      currentRevisionToken: 8,
    })
    expect(getAnnouncementStaleConflict({ response: { status: 400 } })).toBeNull()
  })
})
