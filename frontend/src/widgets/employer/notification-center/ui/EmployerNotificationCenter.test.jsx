import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerActivityFeed from './EmployerActivityFeed'
import EmployerNotificationCenter from './EmployerNotificationCenter'

const api = vi.hoisted(() => ({
  getEmployerActivities: vi.fn(),
  getEmployerNotifications: vi.fn(),
  markAllEmployerNotificationsRead: vi.fn(),
  markEmployerNotificationRead: vi.fn(),
}))

vi.mock('@/entities/notification/employer-notification', async (importOriginal) => ({
  ...await importOriginal(),
  ...api,
}))

const UNREAD_COUNTS = { all: 1, applications: 0, jobs: 0, campaigns: 0, company: 1 }
const NOTIFICATION = {
  public_id: 'eno_1',
  event_type: 'verification_changes_requested',
  category: 'company',
  title: 'Hồ sơ xác thực cần bổ sung',
  message: 'Bổ sung giấy phép kinh doanh.',
  action_path: '/tuyendung/app/employer-verify',
  is_read: false,
  created_at: new Date().toISOString(),
}

function LocationProbe() {
  return <output data-testid="location-search">{useLocation().search}</output>
}

function renderWidget(Widget, entry = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}><Widget /><LocationProbe /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EmployerNotificationCenter', () => {
  beforeEach(() => {
    api.getEmployerNotifications.mockReset().mockResolvedValue({
      count: 1, next: null, results: [NOTIFICATION], unread_counts: UNREAD_COUNTS,
    })
    api.markAllEmployerNotificationsRead.mockReset().mockResolvedValue({ updated: 1 })
    api.markEmployerNotificationRead.mockReset().mockResolvedValue({ is_read: true })
  })

  it('groups notifications by day and marks one read from the row or all at once', async () => {
    const user = userEvent.setup()
    renderWidget(EmployerNotificationCenter)

    expect(await screen.findByRole('heading', { name: 'Hôm nay' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Hồ sơ xác thực cần bổ sung' }))
      .toHaveAttribute('href', '/tuyendung/app/employer-verify')
    expect(screen.getByText('Bổ sung giấy phép kinh doanh.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }))
    await waitFor(() => expect(api.markEmployerNotificationRead.mock.calls[0]?.[0]).toBe('eno_1'))
    await user.click(screen.getByRole('button', { name: /Đánh dấu tất cả đã đọc/ }))
    await waitFor(() => expect(api.markAllEmployerNotificationsRead).toHaveBeenCalled())
  })

  it('filters by group and unread state through the URL', async () => {
    const user = userEvent.setup()
    renderWidget(EmployerNotificationCenter)

    const tabs = await screen.findByRole('group', { name: 'Lọc theo nhóm' })
    expect(await within(tabs).findByRole('button', { name: /1\s*Công ty & xác thực/ })).toBeInTheDocument()
    await user.click(within(tabs).getByRole('button', { name: /Ứng tuyển/ }))
    await user.click(screen.getByRole('button', { name: /Chỉ chưa đọc/ }))

    await waitFor(() => expect(api.getEmployerNotifications).toHaveBeenLastCalledWith({
      category: 'applications', unread: 'true', page: 1,
    }))
    expect(screen.getByTestId('location-search')).toHaveTextContent('?category=applications&unread=true')
  })

  it('tells the user when every notification has been read', async () => {
    api.getEmployerNotifications.mockResolvedValue({ count: 0, next: null, results: [], unread_counts: { all: 0 } })
    renderWidget(EmployerNotificationCenter, '/?unread=true')
    expect(await screen.findByText('Bạn đã đọc hết thông báo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Đánh dấu tất cả đã đọc/ })).toBeDisabled()
  })
})

describe('EmployerActivityFeed', () => {
  beforeEach(() => {
    api.getEmployerActivities.mockReset().mockImplementation(({ page }) => Promise.resolve({
      count: 2,
      next: page === 1 ? 'next' : null,
      category_counts: { all: 2, applications: 1, jobs: 0, campaigns: 0, company: 1 },
      daily_counts: [{ date: '2026-11-21', count: 0 }, { date: '2026-11-22', count: 2 }],
      results: [page === 1
        ? { public_id: 'eac_1', event_type: 'application_received', category: 'applications', summary: 'Có hồ sơ ứng tuyển mới', actor_name: 'Hệ thống', action_path: '/tuyendung/app/applications?application=app_1', occurred_at: new Date().toISOString() }
        : { public_id: 'eac_2', event_type: 'verification_approved', category: 'company', summary: 'Hồ sơ xác thực đã được duyệt', actor_name: 'Quản trị viên', action_path: '', occurred_at: '2026-01-05T03:00:00Z' }],
    }))
  })

  it('loads more history on demand and filters by period', async () => {
    const user = userEvent.setup()
    renderWidget(EmployerActivityFeed)

    expect(await screen.findByRole('link', { name: 'Có hồ sơ ứng tuyển mới' }))
      .toHaveAttribute('href', '/tuyendung/app/applications?application=app_1')
    expect(screen.getByText('Đã hiển thị 1/2')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Biểu đồ số hoạt động 14 ngày qua, tổng 2' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xem thêm' }))
    expect(await screen.findByText('Hồ sơ xác thực đã được duyệt')).toBeInTheDocument()
    expect(screen.getByText('Quản trị viên')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '30 ngày' }))
    await waitFor(() => expect(api.getEmployerActivities).toHaveBeenLastCalledWith({ days: '30', page: 1 }))
    expect(screen.getByRole('button', { name: 'Xóa bộ lọc' })).toBeInTheDocument()
  })
})
