import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CampaignChannelsPanel from './CampaignChannelsPanel'

vi.mock('@/features/employer/campaign/manage-campaign-channels', () => ({
  CampaignChannelBoard: () => <p>Bảng kênh</p>,
  ChannelReport: () => <p>Bảng nguồn</p>,
}))

describe('CampaignChannelsPanel', () => {
  it('keeps one section open at a time and builds the report only once opened', async () => {
    const user = userEvent.setup()
    render(<CampaignChannelsPanel campaign={{ public_id: 'camp_1' }} />)
    const channels = screen.getByRole('button', { name: 'Kênh phân phối' })
    const report = screen.getByRole('button', { name: 'Hiệu quả theo nguồn' })

    expect(channels).toHaveAttribute('aria-expanded', 'true')
    expect(report).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Bảng kênh')).toBeInTheDocument()
    expect(screen.queryByText('Bảng nguồn')).not.toBeInTheDocument()

    await user.click(report)
    expect(report).toHaveAttribute('aria-expanded', 'true')
    expect(channels).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Bảng nguồn')).toBeInTheDocument()

    await user.click(report)
    expect(report).toHaveAttribute('aria-expanded', 'false')
  })
})
