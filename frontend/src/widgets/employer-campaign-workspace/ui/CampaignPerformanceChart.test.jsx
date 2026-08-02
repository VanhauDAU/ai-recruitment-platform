import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

function mockReducedMotion(matches) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
}

describe('CampaignPerformanceChart', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 760,
      height: 300,
      top: 0,
      right: 760,
      bottom: 300,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

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

  it('exposes a concise chart summary and a clear legend', () => {
    render(<CampaignPerformanceChart data={DAILY_DATA} />)

    const chart = screen.getByRole('img', {
      name: 'Biểu đồ lượt hiển thị, lượt xem và lượt ứng tuyển',
    })
    expect(chart).toHaveAccessibleDescription(/2 ngày có dữ liệu từ 21\/07\/2026 đến 22\/07\/2026/)

    const legend = screen.getByRole('list', { name: 'Chú giải biểu đồ' })
    expect(within(legend).getByText('Lượt hiển thị')).toBeInTheDocument()
    expect(within(legend).getByText('Lượt xem')).toBeInTheDocument()
    expect(within(legend).getByText('Lượt ứng tuyển')).toBeInTheDocument()
  })

  it('supports focus, click, Enter, Space and Escape interactions', () => {
    render(<CampaignPerformanceChart data={DAILY_DATA} />)

    const firstPoint = screen.getByTestId('campaign-chart-hit-0')
    const secondPoint = screen.getByTestId('campaign-chart-hit-1')

    fireEvent.focus(firstPoint)
    expect(screen.getByRole('tooltip')).toHaveTextContent('21/07/2026 00:00')

    fireEvent.keyDown(firstPoint, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.keyDown(firstPoint, { key: 'Enter' })
    expect(screen.getByRole('tooltip')).toHaveTextContent('21/07/2026 00:00')

    fireEvent.keyDown(firstPoint, { key: 'Escape' })
    fireEvent.keyDown(firstPoint, { key: ' ' })
    expect(screen.getByRole('tooltip')).toHaveTextContent('21/07/2026 00:00')

    fireEvent.blur(firstPoint)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.click(secondPoint)
    expect(screen.getByRole('tooltip')).toHaveTextContent('22/07/2026 00:00')
  })

  it('keeps unavailable dates as visual gaps instead of zero-valued points', () => {
    mockReducedMotion(true)
    const dataWithGap = [
      { date: '2026-07-18', available: true, impressions: 40, views: 12, applications: 2 },
      { date: '2026-07-19', available: true, impressions: 60, views: 18, applications: 3 },
      { date: '2026-07-20', available: false, impressions: null, views: null, applications: null },
      { date: '2026-07-21', available: true, impressions: 90, views: 24, applications: 4 },
      { date: '2026-07-22', available: true, impressions: 120, views: 30, applications: 5 },
    ]
    const { container } = render(<CampaignPerformanceChart data={dataWithGap} />)

    expect(screen.queryByTestId('campaign-chart-hit-2')).not.toBeInTheDocument()
    const linePaths = [...container.querySelectorAll('.recharts-line-curve')]
    expect(linePaths).toHaveLength(2)
    linePaths.forEach((path) => {
      expect((path.getAttribute('d').match(/M/g) || []).length).toBeGreaterThanOrEqual(2)
    })
  })

  it('disables series animation when reduced motion is preferred', () => {
    mockReducedMotion(true)
    render(<CampaignPerformanceChart data={DAILY_DATA} />)

    expect(screen.getByRole('img', {
      name: 'Biểu đồ lượt hiển thị, lượt xem và lượt ứng tuyển',
    })).toHaveAttribute('data-reduced-motion', 'true')
  })

  it('keeps the chart contract and accessible summary for an empty period', () => {
    render(<CampaignPerformanceChart data={[]} />)

    expect(screen.getByTestId('campaign-performance-chart')).toBeInTheDocument()
    expect(screen.getByRole('img', {
      name: 'Biểu đồ lượt hiển thị, lượt xem và lượt ứng tuyển',
    })).toHaveAccessibleDescription(/Chưa có dữ liệu hiệu quả tuyển dụng/)
    expect(screen.getByText('Chưa đến thời điểm bắt đầu ghi nhận dữ liệu')).toBeInTheDocument()
  })
})
