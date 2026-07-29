import { describe, expect, it } from 'vitest'
import {
  isAnnouncementSurfaceEnabled,
  parseAnnouncementRollout,
} from './announcement-rollout'

describe('announcement rollout', () => {
  it('fails closed when the rollout variable is missing', () => {
    expect([...parseAnnouncementRollout(undefined)]).toEqual([])
    expect(isAnnouncementSurfaceEnabled('candidate', '')).toBe(false)
  })

  it('supports all and an allowlist while ignoring unknown surfaces', () => {
    expect(isAnnouncementSurfaceEnabled('admin_workspace', 'all')).toBe(true)
    expect([
      ...parseAnnouncementRollout(' candidate, employer_workspace,unknown '),
    ]).toEqual(['candidate', 'employer_workspace'])
  })
})
