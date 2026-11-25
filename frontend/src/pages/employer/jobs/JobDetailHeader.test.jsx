import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import JobDetailHeader from './JobDetailHeader'

const SUMMARY = { total: 9, unviewed: 3, unanswered: 5, by_status: {} }
const LIVE_JOB = {
  public_id: 'jb_live',
  code: 'J4829173',
  slug: 'ky-su-frontend',
  title: 'Kỹ sư Frontend',
  status: 'active',
  effective_state: 'active',
  deadline: '2099-12-31',
  first_approved_at: '2099-12-01T02:00:00Z',
  view_count: 480,
  impression_count: 1200,
  campaign: 'camp_1',
  campaign_name: 'Đội sản phẩm',
  job_locations: [{ province_name: 'Đà Nẵng' }, { province_name: 'Đà Nẵng' }],
}

function renderHeader(job, handlers = {}) {
  const props = { onClose: vi.fn(), onDeadlineAction: vi.fn(), onSelectFilter: vi.fn(), ...handlers }
  render(
    <MemoryRouter>
      <JobDetailHeader job={job} publicId={job.public_id} summary={SUMMARY} closing={false} {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('JobDetailHeader', () => {
  it('shows the funnel numbers once and turns the actionable ones into CV filters', () => {
    const props = renderHeader(LIVE_JOB)

    expect(screen.getByRole('heading', { name: 'Kỹ sư Frontend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sao chép mã J4829173' })).toBeInTheDocument()
    expect(screen.getByText('Đà Nẵng', { exact: false })).toHaveTextContent(/^\s*Đà Nẵng$/)
    expect(screen.getByTestId('job-metric-views')).toHaveTextContent('480/ 1.200 hiển thị')
    expect(screen.getByTestId('job-metric-total-cvs')).toHaveTextContent('91,9% tỉ lệ nộp')

    fireEvent.click(screen.getByTestId('job-metric-unviewed-cvs'))
    fireEvent.click(screen.getByTestId('job-metric-unanswered-cvs'))
    expect(props.onSelectFilter.mock.calls).toEqual([['submitted'], ['unanswered']])
    expect(screen.getByRole('link', { name: /Xem tin đăng/ })).toHaveAttribute('href', '/viec-lam/ky-su-frontend')
    expect(screen.getByRole('link', { name: 'Mở chiến dịch Đội sản phẩm' }))
      .toHaveAttribute('href', '/tuyendung/app/campaigns/camp_1?active_tab=job')
  })

  it('keeps closing behind the overflow menu', async () => {
    const props = renderHeader(LIVE_JOB)

    fireEvent.click(screen.getByRole('button', { name: 'Thêm thao tác với tin' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Ngừng tuyển/ }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('offers only the lifecycle actions the backend accepts', () => {
    const extend = renderHeader({ ...LIVE_JOB, effective_state: 'expired', is_expired: true, visibility_ends_at: null })
    fireEvent.click(screen.getByRole('button', { name: /Gia hạn/ }))
    expect(extend.onDeadlineAction).toHaveBeenCalledWith('extend')
    expect(screen.queryByRole('link', { name: /Xem tin đăng/ })).not.toBeInTheDocument()
  })

  it('hides editing and the public link while a job is held', () => {
    renderHeader({ ...LIVE_JOB, effective_state: 'hidden', visibility_hold: { kind: 'moderation', label: 'Tạm ẩn' } })

    const heading = screen.getByRole('heading', { name: 'Kỹ sư Frontend' }).parentElement
    expect(within(heading).getByText('Bị ẩn')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Chỉnh sửa/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Xem tin đăng/ })).not.toBeInTheDocument()
  })

  it('reopens a closed job instead of editing it', () => {
    const props = renderHeader({ ...LIVE_JOB, status: 'closed' })

    expect(screen.queryByRole('button', { name: /Chỉnh sửa/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thêm thao tác với tin' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Mở lại tin/ }))
    expect(props.onDeadlineAction).toHaveBeenCalledWith('reopen')
  })
})
