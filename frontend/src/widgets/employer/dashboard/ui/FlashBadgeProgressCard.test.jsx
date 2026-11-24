import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import FlashBadgeProgressCard from './FlashBadgeProgressCard'

const badge = (overrides = {}) => ({
  enabled: true,
  qualified: false,
  response_hours: 72,
  window_days: 30,
  overdue_count: 2,
  at_risk_count: 1,
  criteria: [
    { code: 'enough_applications', met: true, value: 6, target: 5 },
    { code: 'response_rate', met: false, value: 50, target: 80 },
    { code: 'recent_activity', met: true, value: '2026-11-24T00:00:00Z', target: 7 },
    { code: 'no_overdue', met: false, value: 2, target: 0 },
  ],
  ...overrides,
})

function renderCard(value) {
  return render(<MemoryRouter><FlashBadgeProgressCard badge={value} /></MemoryRouter>)
}

describe('FlashBadgeProgressCard', () => {
  it('lists each criterion and sends the recruiter to the waiting applications', () => {
    renderCard(badge())

    expect(screen.getByText('Chưa đạt', { selector: 'span.rounded-full' })).toBeVisible()
    expect(screen.getByText('Phản hồi trong 72 giờ: 50% (cần từ 80%)')).toBeVisible()
    expect(screen.getByText('2 hồ sơ đang chờ quá hạn')).toBeVisible()
    expect(screen.getByText('1 hồ sơ sẽ quá hạn trong 24 giờ tới')).toBeVisible()
    expect(screen.getByRole('link', { name: /Trả lời hồ sơ đang chờ/ })).toHaveAttribute(
      'href',
      '/tuyendung/app/applications',
    )
  })

  it('shows the earned state without a reply prompt, and nothing when switched off', () => {
    const { rerender } = renderCard(
      badge({
        qualified: true,
        overdue_count: 0,
        at_risk_count: 0,
        criteria: badge().criteria.map((item) => ({ ...item, met: true })),
      }),
    )

    expect(screen.getByText('Đang đạt')).toBeVisible()
    expect(screen.queryByRole('link')).toBeNull()

    rerender(<MemoryRouter><FlashBadgeProgressCard badge={badge({ enabled: false })} /></MemoryRouter>)
    expect(screen.queryByText('Huy hiệu Sấm Chớp')).toBeNull()
  })
})
