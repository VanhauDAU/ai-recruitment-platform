import { describe, expect, it } from 'vitest'
import {
  ANNOUNCEMENT_SURFACES,
  normalizeAnnouncementUrl,
} from '@/entities/announcement'
import {
  announcementCtaRouteGroups,
  announcementCtaRouteInfo,
  announcementPrefixRouteGroups,
  inferAnnouncementCtaMode,
  isValidAnnouncementPathPrefix,
} from './route-catalog'

describe('announcement route catalog', () => {
  it('keeps cross-portal CTA destinations discoverable', () => {
    const groups = announcementCtaRouteGroups([
      ANNOUNCEMENT_SURFACES.CANDIDATE,
    ])

    expect(groups).toHaveLength(4)
    expect(groups.find(({ label }) => label === 'Workspace NTD').options)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringContaining('Tạo tin tuyển dụng'),
          value: '/tuyendung/app/jobs/new',
        }),
      ]))
  })

  it('marks public employer marketing CTAs as accessible without login', () => {
    expect(announcementCtaRouteInfo('/tuyendung/dich-vu')).toEqual(
      expect.objectContaining({
        access: 'public',
        surface: ANNOUNCEMENT_SURFACES.EMPLOYER_MARKETING,
        surfaceLabel: 'Marketing NTD',
      }),
    )
  })

  it('builds route-prefix choices instead of requiring operators to guess', () => {
    const groups = announcementPrefixRouteGroups([
      ANNOUNCEMENT_SURFACES.CANDIDATE,
    ])

    expect(groups[0].options).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: expect.stringContaining('Cài đặt gợi ý việc làm'),
        value: '/tai-khoan/cai-dat-goi-y-viec-lam',
      }),
    ]))
  })

  it.each([
    ['/', true],
    ['/viec-lam', true],
    ['/viec-lam/', true],
    ['viec-lam', false],
    ['//evil.example', false],
    ['/viec-lam?page=2', false],
    ['/viec-lam#top', false],
  ])('validates path prefix %s', (value, expected) => {
    expect(isValidAnnouncementPathPrefix(value)).toBe(expected)
  })

  it('infers CTA modes for persisted values', () => {
    expect(inferAnnouncementCtaMode('')).toBe('none')
    expect(inferAnnouncementCtaMode('/viec-lam')).toBe('internal')
    expect(inferAnnouncementCtaMode('https://status.example.com')).toBe('external')
  })

  it('keeps every registered CTA and prefix safe for runtime contracts', () => {
    for (const group of announcementCtaRouteGroups()) {
      for (const option of group.options) {
        expect(normalizeAnnouncementUrl(option.value)?.url, option.label).toBe(option.value)
        expect(['public', 'authenticated'], option.label).toContain(option.access)
      }
    }
    for (const group of announcementPrefixRouteGroups()) {
      for (const option of group.options) {
        expect(isValidAnnouncementPathPrefix(option.value), option.label).toBe(true)
      }
    }
  })
})
