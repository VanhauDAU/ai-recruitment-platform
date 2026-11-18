import { describe, expect, it } from 'vitest'
import { resolveActiveAdminAccountTab } from './tab-state'

const employerTabs = [
  { key: 'overview' },
  { key: 'profile' },
  { key: 'verification' },
]

describe('resolveActiveAdminAccountTab', () => {
  it('keeps a shareable verification deep-link active', () => {
    expect(resolveActiveAdminAccountTab(employerTabs, 'verification')).toBe('verification')
  })

  it('falls back safely when the requested tab does not belong to the role', () => {
    expect(resolveActiveAdminAccountTab(employerTabs, 'consents')).toBe('overview')
  })
})
