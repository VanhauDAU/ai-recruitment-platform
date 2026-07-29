import { describe, expect, it } from 'vitest'
import {
  normalizeAnnouncement,
  normalizeAnnouncementFeed,
  normalizeAnnouncementUrl,
} from './announcement.contract'

describe('announcement runtime contract', () => {
  it('accepts only application paths and HTTPS external links', () => {
    expect(normalizeAnnouncementUrl('/viec-lam/backend')).toEqual({
      external: false,
      url: '/viec-lam/backend',
    })
    expect(normalizeAnnouncementUrl('https://status.example.com')).toEqual({
      external: true,
      url: 'https://status.example.com',
    })
    expect(normalizeAnnouncementUrl('//evil.example')).toBeNull()
    expect(normalizeAnnouncementUrl('http://evil.example')).toBeNull()
    expect(normalizeAnnouncementUrl('https://user:secret@example.com')).toBeNull()
    expect(normalizeAnnouncementUrl('javascript:alert(1)')).toBeNull()
  })

  it('normalizes safe defaults and drops malformed records', () => {
    expect(normalizeAnnouncement({ public_id: '', message: 'Thiếu mã' })).toBeNull()
    expect(normalizeAnnouncement({ public_id: 'ann_empty', message: '' })).toBeNull()

    const item = normalizeAnnouncement({
      public_id: 'ann_safe',
      revision: 2,
      kind: 'unknown',
      priority_tier: 99,
      priority: 5000,
      message: '  Nội dung an toàn  ',
      icon: '<script>',
      animation: 'bounce',
      display_seconds: 2,
      cta: { label: 'Mở', url: 'javascript:alert(1)' },
      dismiss: { mode: 'unknown', version: 0 },
    })

    expect(item).toMatchObject({
      id: 'ann_safe',
      revision: 2,
      source: 'remote',
      kind: 'info',
      priorityTier: 6,
      priority: 50,
      message: 'Nội dung an toàn',
      icon: 'info',
      cta: null,
      animation: 'slide',
      displaySeconds: 6,
      dismiss: { mode: 'locked', version: 1 },
    })
  })

  it('keeps Vietnamese fallback fields and ignores invalid transition dates', () => {
    expect(normalizeAnnouncementFeed({
      remote_enabled: true,
      items: [{
        public_id: 'ann_vi',
        message: '',
        message_vi: 'Nội dung tiếng Việt',
        dismiss: { mode: 'close', version: 3 },
      }],
      next_transition_at: 'not-a-date',
    })).toMatchObject({
      remoteEnabled: true,
      items: [{
        id: 'ann_vi',
        message: 'Nội dung tiếng Việt',
        dismiss: { mode: 'close', version: 3 },
      }],
      nextTransitionAt: null,
    })
  })

  it('drops remote items when the runtime kill switch is absent or disabled', () => {
    const payload = {
      items: [{
        public_id: 'ann_disabled',
        message: 'Không được hiển thị.',
        dismiss: { mode: 'locked', version: 1 },
      }],
      next_transition_at: '2099-01-01T00:00:00Z',
    }

    expect(normalizeAnnouncementFeed(payload)).toEqual({
      items: [],
      nextTransitionAt: null,
      remoteEnabled: false,
    })
    expect(normalizeAnnouncementFeed({
      ...payload,
      remote_enabled: false,
    }).items).toEqual([])
  })
})
