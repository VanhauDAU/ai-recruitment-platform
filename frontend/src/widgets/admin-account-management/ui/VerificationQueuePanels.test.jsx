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
  verificationStatusMeta: () => ({ color: 'default', label: 'Chờ duyệt' }),
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
    expect(screen.queryByRole('heading', { name: 'Yêu cầu sửa thông tin công ty' })).not.toBeInTheDocument()
    await waitFor(() => expect(apiMocks.getAdminEmployerVerifications).toHaveBeenCalled())
  })
})
