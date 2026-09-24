import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerNotificationCenter from './EmployerNotificationCenter'

const api = vi.hoisted(() => ({
  getEmployerNotifications: vi.fn(),
  markAllEmployerNotificationsRead: vi.fn(),
  markEmployerNotificationRead: vi.fn(),
  employerNotificationKeys: {
    all: ['employer-notifications'],
    list: (page) => ['employer-notifications', 'list', page],
  },
  employerNotificationTone: () => 'warning',
  formatEmployerEventTime: () => '10/08/2026, 09:00',
}))

vi.mock('@/entities/employer-notification', () => api)

function renderCenter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><EmployerNotificationCenter /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EmployerNotificationCenter', () => {
  beforeEach(() => {
    api.getEmployerNotifications.mockReset()
    api.markAllEmployerNotificationsRead.mockReset().mockResolvedValue({ updated: 1 })
    api.markEmployerNotificationRead.mockReset().mockResolvedValue({ is_read: true })
  })

  it('renders server notifications and marks one as read before opening its deep link', async () => {
    api.getEmployerNotifications.mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'eno_1',
        event_type: 'verification_changes_requested',
        title: 'Hồ sơ xác thực cần bổ sung',
        message: 'Bổ sung giấy phép kinh doanh.',
        action_path: '/tuyendung/app/employer-verify',
        is_read: false,
        created_at: '2026-08-10T02:00:00Z',
      }],
    })
    const user = userEvent.setup()
    renderCenter()

    const link = await screen.findByRole('link', { name: /Hồ sơ xác thực cần bổ sung/ })
    expect(link).toHaveAttribute('href', '/tuyendung/app/employer-verify')
    await user.click(link)
    await waitFor(() => expect(api.markEmployerNotificationRead.mock.calls[0]?.[0]).toBe('eno_1'))
  })

  it('shows a deliberate empty state', async () => {
    api.getEmployerNotifications.mockResolvedValue({ count: 0, results: [] })
    renderCenter()
    expect(await screen.findByText('Chưa có thông báo')).toBeInTheDocument()
  })
})
