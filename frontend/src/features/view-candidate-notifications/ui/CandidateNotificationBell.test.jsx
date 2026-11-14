import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CandidateNotificationBell from './CandidateNotificationBell'

const api = vi.hoisted(() => ({
  getCandidateNotifications: vi.fn(),
  getCandidateNotificationUnreadCount: vi.fn(),
  markCandidateNotificationRead: vi.fn(),
  markAllCandidateNotificationsRead: vi.fn(),
}))
vi.mock('@/entities/candidate-notification', async (importOriginal) => ({
  ...(await importOriginal()),
  ...api,
}))

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><CandidateNotificationBell /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CandidateNotificationBell', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    api.getCandidateNotificationUnreadCount.mockResolvedValue({ count: 1 })
    api.getCandidateNotifications.mockResolvedValue({
      results: [{
        public_id: 'cno_1',
        event_type: 'application_interviewed',
        title: 'Bạn được mời phỏng vấn',
        message: 'Acme mời bạn phỏng vấn vị trí Backend.',
        action_path: '/tai-khoan/viec-lam-da-ung-tuyen',
        is_read: false,
        delivered_at: '2026-11-15T09:00:00+07:00',
      }],
    })
    api.markAllCandidateNotificationsRead.mockResolvedValue({ updated: 1 })
  })

  it('loads the list only when opened and marks everything read', async () => {
    const user = userEvent.setup()
    renderBell()

    expect(await screen.findByText('1')).toBeInTheDocument()
    expect(api.getCandidateNotifications).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Mở thông báo' }))
    expect(await screen.findByText('Bạn được mời phỏng vấn')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }))

    expect(screen.getByRole('link', { name: 'Cài đặt thông báo' })).toHaveAttribute('href', '/tai-khoan/cai-dat-nhan-email')
    await waitFor(() => expect(api.markAllCandidateNotificationsRead).toHaveBeenCalled())
  })
})
