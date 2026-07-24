import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CampaignPerformanceChart from './CampaignPerformanceChart'

const DAILY_DATA = [
  {
    date: '2026-07-21',
    available: true,
    impressions: 1250,
    views: 320,
    applications: 48,
  },
  {
    date: '2026-07-22',
    available: true,
    impressions: 980,
    views: 210,
    applications: 32,
  },
]

describe('CampaignPerformanceChart', () => {
  it('shows a detailed tooltip and active guide for the hovered date', () => {
    render(<CampaignPerformanceChart data={DAILY_DATA} />)

    fireEvent.mouseEnter(screen.getByTestId('campaign-chart-hit-0'))

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('21/07/2026 00:00')
    expect(within(tooltip).getByText('Lượt hiển thị')).toBeInTheDocument()
    expect(within(tooltip).getByText('1.250')).toBeInTheDocument()
    expect(within(tooltip).getByText('Lượt xem')).toBeInTheDocument()
    expect(within(tooltip).getByText('320')).toBeInTheDocument()
    expect(within(tooltip).getByText('Lượt ứng tuyển')).toBeInTheDocument()
    expect(within(tooltip).getByText('48')).toBeInTheDocument()
    expect(screen.getByTestId('campaign-chart-active-marker')).toBeInTheDocument()
  })

  it('updates the tooltip when hovering another date and hides it on mouse leave', () => {
    render(<CampaignPerformanceChart data={DAILY_DATA} />)

    fireEvent.mouseEnter(screen.getByTestId('campaign-chart-hit-1'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('22/07/2026 00:00')
    expect(screen.getByRole('tooltip')).toHaveTextContent('980')

    fireEvent.mouseLeave(screen.getByRole('img', {
      name: 'Biểu đồ lượt hiển thị, lượt xem và lượt ứng tuyển',
    }))

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
