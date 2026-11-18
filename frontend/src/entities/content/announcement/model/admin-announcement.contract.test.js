import { describe, expect, it } from 'vitest'
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_SURFACES,
  latestAnnouncementRevision,
  normalizeAdminAnnouncementDetail,
  normalizeAdminAnnouncementMetrics,
  normalizeAdminAnnouncementPage,
} from '..'

describe('admin announcement contract', () => {
  it('normalizes paginated list data without trusting optional aggregates', () => {
    const page = normalizeAdminAnnouncementPage({
      count: '2',
      results: [{
        public_id: 'ann_1',
        internal_name: 'Thông báo',
        surfaces: null,
        impressions: '10',
        clicks: undefined,
      }],
    })

    expect(page.count).toBe(2)
    expect(page.results[0]).toMatchObject({
      public_id: 'ann_1',
      surfaces: [],
      impressions: 10,
      clicks: 0,
    })
  })

  it('keeps immutable revisions and audit events newest-first from the API', () => {
    const detail = normalizeAdminAnnouncementDetail({
      public_id: 'ann_1',
      revision_token: '4',
      revisions: [{
        number: 2,
        message_vi: 'Revision 2',
        kind: ANNOUNCEMENT_KINDS.SECURITY,
        surfaces: [ANNOUNCEMENT_SURFACES.ADMIN_WORKSPACE],
        auth_audiences: [ANNOUNCEMENT_AUDIENCES.AUTHENTICATED],
      }],
      audit_events: [{
        public_id: 'alog_1',
        action: 'announcement_publish',
        actor: { public_id: 'usr_admin', name: 'Admin' },
      }],
    })

    expect(detail.revision_token).toBe(4)
    expect(latestAnnouncementRevision(detail).message_vi).toBe('Revision 2')
    expect(detail.audit_events[0]).toMatchObject({
      action: 'announcement_publish',
      actor: { name: 'Admin' },
    })
  })

  it('normalizes the server-wide metric report independently from pagination', () => {
    const metrics = normalizeAdminAnnouncementMetrics({
      public_id: 'ann_1',
      consent_notice: 'Chỉ gồm Analytics consent.',
      summary: {
        impressions: '20',
        clicks: 5,
        ctr: '25',
        dismiss_rate: '10',
      },
      daily: [{ date: '2026-07-29', surface: 'candidate', impressions: '20' }],
    })

    expect(metrics.summary).toMatchObject({
      impressions: 20,
      clicks: 5,
      ctr: 25,
      dismiss_rate: 10,
    })
    expect(metrics.daily[0]).toMatchObject({
      date: '2026-07-29',
      surface: 'candidate',
      impressions: 20,
    })
  })
})
