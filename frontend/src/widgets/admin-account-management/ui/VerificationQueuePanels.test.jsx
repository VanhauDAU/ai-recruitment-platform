import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VerificationQueuePanel from './VerificationQueuePanel'

const apiMocks = vi.hoisted(() => ({
  getAdminEmployerVerifications: vi.fn(),
}))

vi.mock('@/entities/admin-employer-verification', () => ({
  adminEmployerVerificationKeys: {
    list: (params) => ['admin-employer-verifications', 'list', params],
  },
  getAdminEmployerVerifications: apiMocks.getAdminEmployerVerifications,
  verificationStatusMeta: (status) => (
    status === 'rejected'
      ? { color: 'red', label: 'Bị từ chối' }
      : { color: 'gold', label: 'Chờ duyệt' }
  ),
}))

function renderPanel(panel) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <App>{panel}</App>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('admin employer review queues', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps employer verification records in their own panel', async () => {
    apiMocks.getAdminEmployerVerifications.mockResolvedValue({ count: 0, results: [] })

    renderPanel(<VerificationQueuePanel />)

    expect(screen.getByRole('heading', { name: 'Hồ sơ xác thực nhà tuyển dụng' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Trạng thái xác thực NTD' })).toBeInTheDocument()
    expect(screen.getByText('Chờ duyệt', { selector: '.ant-select-content' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Yêu cầu sửa thông tin công ty' })).not.toBeInTheDocument()
    await waitFor(() => expect(apiMocks.getAdminEmployerVerifications).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
  })

  it('shows a resubmitted file as pending even when another file keeps the case rejected', async () => {
    apiMocks.getAdminEmployerVerifications.mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'evc_mixed',
        user_public_id: 'usr_employer',
        full_name: 'Nhà tuyển dụng',
        email: 'employer@example.com',
        company: { name: 'Công ty kiểm thử', tax_code: '0101234567' },
        status: 'rejected',
        pending_document_count: 1,
        missing_steps: [],
        phone_verified: true,
        submitted_at: '2026-07-28T14:54:15Z',
      }],
    })

    renderPanel(<VerificationQueuePanel />)

    expect(await screen.findByText('1 file chờ duyệt')).toBeVisible()
    expect(screen.getByText('Hồ sơ: Bị từ chối')).toBeVisible()
  })
})
