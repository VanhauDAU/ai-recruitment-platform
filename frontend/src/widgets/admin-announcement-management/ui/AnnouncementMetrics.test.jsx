import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AnnouncementMetrics from './AnnouncementMetrics'

const { getAdminAnnouncementMetrics } = vi.hoisted(() => ({
  getAdminAnnouncementMetrics: vi.fn(),
}))

vi.mock('@/entities/announcement', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminAnnouncementMetrics,
}))

describe('AnnouncementMetrics', () => {
  it('renders consent-scoped server aggregates and daily rows', async () => {
    getAdminAnnouncementMetrics.mockResolvedValue({
      public_id: 'ann_1',
      consent_notice: 'Chỉ gồm người dùng đã bật Analytics.',
      summary: {
        impressions: 200,
        clicks: 25,
        ctr: 12.5,
        dismisses: 4,
        dismiss_rate: 2,
      },
      daily: [{
        date: '2026-07-29',
        surface: 'candidate',
        impressions: 200,
        clicks: 25,
        ctr: 12.5,
        dismisses: 4,
      }],
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AnnouncementMetrics publicId="ann_1" />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Chỉ gồm người dùng đã bật Analytics.'))
      .toBeInTheDocument()
    expect(screen.getAllByText('200')).not.toHaveLength(0)
    expect(screen.getByText('Ứng viên')).toBeInTheDocument()
    expect(getAdminAnnouncementMetrics).toHaveBeenCalledWith(
      'ann_1',
      expect.objectContaining({ date_from: expect.any(String), date_to: expect.any(String) }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })
})
