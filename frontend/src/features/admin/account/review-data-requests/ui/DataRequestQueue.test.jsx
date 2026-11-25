import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findTableRow, getButtonByText } from '@/test/antd-queries'
import DataRequestQueue from './DataRequestQueue'

const mocks = vi.hoisted(() => ({
  getAdminDataRequests: vi.fn(),
  completeAdminDataRequest: vi.fn(),
  rejectAdminDataRequest: vi.fn(),
}))

vi.mock('@/entities/account/data-request', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminDataRequests: mocks.getAdminDataRequests,
  completeAdminDataRequest: mocks.completeAdminDataRequest,
  rejectAdminDataRequest: mocks.rejectAdminDataRequest,
}))
vi.mock('@/shared/lib/toast', () => ({ message: { error: vi.fn(), success: vi.fn() } }))

const ROW = {
  public_id: 'dsr_1',
  kind: 'erasure',
  kind_label: 'Xóa tài khoản',
  status: 'pending',
  status_label: 'Chờ xử lý',
  note: 'Không dùng nữa',
  resolution_note: '',
  created_at: '2026-11-24T01:00:00Z',
  handled_at: null,
  export_available_until: null,
  account: { public_id: 'UV1234', email: 'ungvien@example.com', full_name: 'A', role: 'candidate', is_deleted: false },
  handled_by_email: null,
}

function renderQueue() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  return render(
    <App>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/app/privacy-requests']}><DataRequestQueue /></MemoryRouter>
      </QueryClientProvider>
    </App>,
  )
}

describe('DataRequestQueue', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getAdminDataRequests.mockResolvedValue({ count: 1, results: [ROW] })
    mocks.completeAdminDataRequest.mockResolvedValue({})
    mocks.rejectAdminDataRequest.mockResolvedValue({})
  })

  it('loads the pending queue and completes an erasure only after confirming', async () => {
    renderQueue()
    const row = await findTableRow('dsr_1')
    expect(mocks.getAdminDataRequests.mock.calls[0][0]).toEqual({ status: 'pending', page: 1 })
    expect(row.textContent).toContain('ungvien@example.com')

    fireEvent.click(getButtonByText(row, 'Hoàn tất'))
    const dialog = await screen.findByRole('dialog')
    expect(mocks.completeAdminDataRequest).not.toHaveBeenCalled()
    fireEvent.click(getButtonByText(dialog, 'Xác nhận'))
    await waitFor(() => expect(mocks.completeAdminDataRequest).toHaveBeenCalledWith('dsr_1'))
  })

  it('requires a reason before rejecting', async () => {
    renderQueue()
    fireEvent.click(getButtonByText(await findTableRow('dsr_1'), 'Từ chối'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(getButtonByText(dialog, 'Từ chối'))
    expect(mocks.rejectAdminDataRequest).not.toHaveBeenCalled()

    fireEvent.change(dialog.querySelector('textarea'), { target: { value: 'Đang có tranh chấp' } })
    fireEvent.click(getButtonByText(dialog, 'Từ chối'))
    await waitFor(() => expect(mocks.rejectAdminDataRequest).toHaveBeenCalledWith('dsr_1', 'Đang có tranh chấp'))
  })
})
