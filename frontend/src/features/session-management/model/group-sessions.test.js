import { describe, expect, it } from 'vitest'
import { groupSessions } from './group-sessions'

describe('groupSessions', () => {
  it('keeps one active row for the same portal, IP, and device label', () => {
    expect(groupSessions([
      { id: 'old', portal: 'admin', ip_address: '192.168.65.1', device_label: 'Chrome trên macOS', revoked_at: '2026-07-26T06:00:00Z', current: false },
      { id: 'active', portal: 'admin', ip_address: '192.168.65.1', device_label: 'Chrome trên macOS', revoked_at: null, current: false },
      { id: 'other', portal: 'admin', ip_address: '192.168.65.1', device_label: 'Safari trên macOS', revoked_at: null, current: false },
    ])).toEqual([
      { id: 'active', portal: 'admin', ip_address: '192.168.65.1', device_label: 'Chrome trên macOS', revoked_at: null, current: false },
      { id: 'other', portal: 'admin', ip_address: '192.168.65.1', device_label: 'Safari trên macOS', revoked_at: null, current: false },
    ])
  })
})
