import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerCompanyDomainVerification from './EmployerCompanyDomainVerification'

const api = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  manual: vi.fn(),
  rotate: vi.fn(),
  verify: vi.fn(),
}))

vi.mock('@/entities/employer-profile', async (importOriginal) => ({
  ...await importOriginal(),
  createEmployerCompanyDomainClaim: api.create,
  getEmployerCompanyDomainClaims: api.list,
  requestEmployerCompanyDomainManualReview: api.manual,
  rotateEmployerCompanyDomainClaim: api.rotate,
  verifyEmployerCompanyDomainClaim: api.verify,
}))

function renderFeature() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <App>
      <QueryClientProvider client={client}>
        <EmployerCompanyDomainVerification companyLinked />
      </QueryClientProvider>
    </App>,
  )
}

const pendingClaim = {
  public_id: 'dmc_1',
  domain: 'company.vn',
  method: 'dns_txt',
  status: 'pending',
  txt_name: '_procv-verification.company.vn',
  lock_version: 2,
  allowed_actions: ['verify', 'rotate', 'request_manual_review'],
}

describe('EmployerCompanyDomainVerification', () => {
  beforeEach(() => {
    api.create.mockReset()
    api.list.mockReset()
    api.manual.mockReset()
    api.rotate.mockReset()
    api.verify.mockReset()
  })

  it('creates a domain derived by the backend and reveals the one-time TXT value', async () => {
    api.list.mockResolvedValue([])
    api.create.mockResolvedValue({ ...pendingClaim, txt_value: 'procv-verification=secret' })
    renderFeature()

    await userEvent.click(await screen.findByRole('button', { name: 'Tạo mã xác minh' }))

    expect(api.create).toHaveBeenCalled()
    expect(await screen.findByText('company.vn')).toBeVisible()
    expect(screen.getByText('procv-verification=secret')).toBeVisible()
  })

  it('checks DNS only when the backend advertises the action', async () => {
    api.list.mockResolvedValue([pendingClaim])
    api.verify.mockResolvedValue({
      ...pendingClaim,
      status: 'verified',
      allowed_actions: [],
    })
    renderFeature()

    const claimCard = (await screen.findByText('company.vn')).closest('article')
    expect(screen.queryByRole('button', { name: 'Tạo mã xác minh' })).not.toBeInTheDocument()
    expect(claimCard).toHaveTextContent('Kiểm tra DNS')
    await userEvent.click(screen.getByRole('button', { name: 'Kiểm tra DNS' }))

    await waitFor(() => expect(api.verify).toHaveBeenCalledWith('dmc_1'))
    expect(await screen.findByText('Đã xác minh')).toBeVisible()
  })

  it('requires a meaningful reason for manual review and includes the lock version', async () => {
    api.list.mockResolvedValue([pendingClaim])
    api.manual.mockResolvedValue({
      ...pendingClaim,
      status: 'pending',
      allowed_actions: [],
    })
    renderFeature()

    await userEvent.click(await screen.findByRole('button', { name: 'Yêu cầu duyệt thủ công' }))
    await userEvent.type(
      screen.getByLabelText('Lý do không thể xác minh bằng DNS'),
      'Domain do tập đoàn quản lý tập trung.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }))

    await waitFor(() => expect(api.manual).toHaveBeenCalledWith('dmc_1', {
      lockVersion: 2,
      reason: 'Domain do tập đoàn quản lý tập trung.',
    }))
  })

  it('does not show stale DNS instructions while manual review is pending', async () => {
    api.list.mockResolvedValue([{
      ...pendingClaim,
      method: 'admin_manual',
      status: 'pending',
      allowed_actions: [],
    }])
    renderFeature()

    expect(await screen.findByText('Đang chờ duyệt thủ công')).toBeVisible()
    expect(screen.queryByText('Tên bản ghi')).not.toBeInTheDocument()
  })
})
