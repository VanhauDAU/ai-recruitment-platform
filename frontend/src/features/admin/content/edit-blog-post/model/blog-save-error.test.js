import { describe, expect, it } from 'vitest'
import { isBlogRevisionConflict } from './blog-save-error'

describe('isBlogRevisionConflict', () => {
  it('accepts only the dedicated optimistic-lock conflict', () => {
    expect(isBlogRevisionConflict({
      response: {
        status: 409,
        data: { code: 'blog_resource_changed' },
      },
    })).toBe(true)

    expect(isBlogRevisionConflict({
      response: {
        status: 409,
        data: { code: 'another_conflict' },
      },
    })).toBe(false)
    expect(isBlogRevisionConflict({
      response: {
        status: 500,
        data: { code: 'blog_resource_changed' },
      },
    })).toBe(false)
  })
})
