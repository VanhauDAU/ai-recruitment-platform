// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { resolveActiveAdminAccountTab } from './tab-state'

const employerTabs = [
  { key: 'overview' },
  { key: 'verification' },
  { key: 'activity' },
]

describe('resolveActiveAdminAccountTab', () => {
  it('keeps a shareable verification deep-link active', () => {
    expect(resolveActiveAdminAccountTab(employerTabs, 'verification')).toBe('verification')
  })

  it('sends the old employer profile link to the merged overview', () => {
    expect(resolveActiveAdminAccountTab(employerTabs, 'profile')).toBe('overview')
    expect(resolveActiveAdminAccountTab([{ key: 'overview' }, { key: 'profile' }], 'profile')).toBe('profile')
  })

  it('falls back safely when the requested tab does not belong to the role', () => {
    expect(resolveActiveAdminAccountTab(employerTabs, 'consents')).toBe('overview')
  })
})
