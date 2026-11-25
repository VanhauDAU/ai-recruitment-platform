import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfigProvider } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getButtonByText } from '@/test/antd-queries'
import DataRequestsPanel from './DataRequestsPanel'

const mocks = vi.hoisted(() => ({
  listMyDataRequests: vi.fn(),
  submitDataRequest: vi.fn(),
  cancelDataRequest: vi.fn(),
  fetchDataExport: vi.fn(),
  triggerBlobDownload: vi.fn(),
}))

vi.mock('@/entities/account/data-request', async (importOriginal) => ({
  ...(await importOriginal()),
  listMyDataRequests: mocks.listMyDataRequests,
  submitDataRequest: mocks.submitDataRequest,
  cancelDataRequest: mocks.cancelDataRequest,
  fetchDataExport: mocks.fetchDataExport,
}))
vi.mock('@/shared/lib/download-blob', () => ({ triggerBlobDownload: mocks.triggerBlobDownload }))
vi.mock('@/shared/lib/toast', () => ({ message: { error: vi.fn(), success: vi.fn() } }))

const future = new Date(Date.now() + 86_400_000).toISOString()

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  return render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <QueryClientProvider client={queryClient}><DataRequestsPanel /></QueryClientProvider>
    </ConfigProvider>,
  )
}

describe('DataRequestsPanel', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.listMyDataRequests.mockResolvedValue([])
    mocks.submitDataRequest.mockResolvedValue({})
  })

  it('sends an export request right away and an erasure request only after the confirmation', async () => {
    const { container } = renderPanel()
    fireEvent.click(await waitFor(() => getButtonByText(container, 'Yêu cầu xuất dữ liệu')))
    await waitFor(() => expect(mocks.submitDataRequest.mock.calls[0][0]).toEqual({ kind: 'export' }))

    fireEvent.click(getButtonByText(container, 'Yêu cầu xóa tài khoản'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(dialog.querySelector('textarea'), { target: { value: 'Không dùng nữa' } })
    expect(mocks.submitDataRequest).toHaveBeenCalledTimes(1)
    fireEvent.click(getButtonByText(dialog, 'Gửi yêu cầu xóa'))
    await waitFor(() => expect(mocks.submitDataRequest.mock.calls[1][0]).toEqual({ kind: 'erasure', note: 'Không dùng nữa' }))
  })

  it('downloads an approved export and lets a pending request be cancelled', async () => {
    mocks.listMyDataRequests.mockResolvedValue([
      { public_id: 'dsr_export', kind: 'export', kind_label: 'Xuất dữ liệu', status: 'completed', status_label: 'Đã xử lý', created_at: '2026-11-20T01:00:00Z', export_available_until: future, resolution_note: '' },
      { public_id: 'dsr_erase', kind: 'erasure', kind_label: 'Xóa tài khoản', status: 'pending', status_label: 'Chờ xử lý', created_at: '2026-11-21T01:00:00Z', export_available_until: null, resolution_note: '' },
    ])
    mocks.fetchDataExport.mockResolvedValue(new Blob(['{}']))
    mocks.cancelDataRequest.mockResolvedValue({})
    const { container } = renderPanel()

    await screen.findByText('Xóa tài khoản', { selector: 'li div' })
    expect(getButtonByText(container, 'Đang chờ xử lý')).toBeDisabled()
    fireEvent.click(getButtonByText(container, 'Tải dữ liệu'))
    await waitFor(() => expect(mocks.triggerBlobDownload).toHaveBeenCalledWith(expect.any(Blob), 'procv-data-dsr_export.json'))
    fireEvent.click(getButtonByText(container, 'Hủy yêu cầu'))
    await waitFor(() => expect(mocks.cancelDataRequest.mock.calls[0][0]).toBe('dsr_erase'))
  })
})
