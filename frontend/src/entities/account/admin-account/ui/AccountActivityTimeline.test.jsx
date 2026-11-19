import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccountActivityTimeline from './AccountActivityTimeline'

const api = vi.hoisted(() => ({ getAdminAccountActivity: vi.fn() }))
vi.mock('../api/admin-account.api', () => api)

const today = new Date()
today.setHours(9, 5, 0, 0)

function renderTimeline(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AccountActivityTimeline publicId="usr_1" {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AccountActivityTimeline', () => {
  beforeEach(() => {
    api.getAdminAccountActivity.mockReset()
    api.getAdminAccountActivity
      .mockResolvedValueOnce({
        results: [{
          id: 'auth:1',
          category: 'security',
          event: 'login',
          title: 'Đăng nhập cổng NTD',
          summary: 'Mật khẩu · Chrome',
          tone: 'neutral',
          actor: { type: 'self', label: 'Chính tài khoản' },
          occurred_at: today.toISOString(),
          details: [{ label: 'Địa chỉ IP', value: '203.0.113.5', type: 'text' }],
        }],
        next_cursor: 'cursor-2',
        category_counts: { all: 2, security: 1, account: 0, verification: 1, company: 0, recruitment: 0 },
      })
      .mockResolvedValue({
        results: [{
          id: 'vevt:2',
          category: 'verification',
          event: 'approved',
          title: 'Duyệt hồ sơ xác thực',
          summary: '',
          tone: 'success',
          actor: { type: 'admin', label: 'admin@example.com' },
          occurred_at: '2026-01-05T03:00:00Z',
          details: [],
        }],
        next_cursor: null,
      })
  })

  it('groups by day with a clock time, category chips with counts and paging', async () => {
    renderTimeline()

    expect(await screen.findByText('Đăng nhập cổng NTD')).toBeInTheDocument()
    expect(screen.getByText('Hôm nay')).toBeInTheDocument()
    expect(screen.getByText('09:05')).toBeInTheDocument()
    expect(screen.getByText('Chính tài khoản')).toBeInTheDocument()
    expect(screen.getByText('203.0.113.5')).toBeInTheDocument()
    expect(screen.getByText('Bảo mật', { selector: 'button' })).toHaveTextContent('Bảo mật1')

    fireEvent.click(screen.getByText('Tải thêm hoạt động cũ hơn'))
    expect(await screen.findByText('Duyệt hồ sơ xác thực')).toBeInTheDocument()
    expect(api.getAdminAccountActivity).toHaveBeenLastCalledWith(
      'usr_1',
      { before: 'cursor-2', category: '', limit: 30 },
      expect.anything(),
    )
    expect(screen.getByText('admin@example.com')).toBeInTheDocument()
  })

  it('filters by category through the API', async () => {
    renderTimeline()
    await screen.findByText('Đăng nhập cổng NTD')
    fireEvent.click(screen.getByText('Xác thực', { selector: 'button' }))
    await waitFor(() => expect(api.getAdminAccountActivity).toHaveBeenLastCalledWith(
      'usr_1',
      { before: '', category: 'verification', limit: 30 },
      expect.anything(),
    ))
  })
})
