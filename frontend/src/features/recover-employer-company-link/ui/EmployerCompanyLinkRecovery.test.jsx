import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerCompanyLinkRecovery from './EmployerCompanyLinkRecovery'

const api = vi.hoisted(() => ({
  adminAccountKeys: { all: ['admin-accounts'] },
  getEmployerCompanyUnlinkImpact: vi.fn(),
  unlinkEmployerCompany: vi.fn(),
}))
const toast = vi.hoisted(() => ({ message: { error: vi.fn(), success: vi.fn() } }))

vi.mock('@/entities/admin-account', () => api)
vi.mock('@/shared/lib/toast', () => toast)

function renderRecovery(props = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <App>
      <QueryClientProvider client={client}>
        <EmployerCompanyLinkRecovery
          publicId="usr_employer"
          company={{ public_id: 'com_wrong', name: 'Công ty chọn nhầm' }}
          companyRole="member"
          enabled
          {...props}
        />
      </QueryClientProvider>
    </App>,
  )
}

describe('EmployerCompanyLinkRecovery', () => {
  beforeEach(() => {
    api.getEmployerCompanyUnlinkImpact.mockReset()
    api.unlinkEmployerCompany.mockReset()
    toast.message.error.mockReset()
    toast.message.success.mockReset()
  })

  it('requires impact preview and only confirms a clean link', async () => {
    api.getEmployerCompanyUnlinkImpact.mockResolvedValue({
      can_apply: true,
      blockers: [],
      counts: { company_documents: 0, company_update_requests: 0, campaigns: 0, jobs: 0 },
      impact_token: 'impact-clean',
    })
    api.unlinkEmployerCompany.mockResolvedValue({ context: { company: null } })
    const user = userEvent.setup()
    renderRecovery()

    await user.click(screen.getByRole('button', { name: /Gỡ liên kết$/ }))
    await user.type(screen.getByLabelText('Lý do xử lý'), 'Nhà tuyển dụng chọn nhầm công ty')
    await user.click(screen.getByRole('button', { name: 'Xem tác động' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Liên kết đủ điều kiện gỡ an toàn')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận gỡ liên kết' }))

    await waitFor(() => {
      expect(api.unlinkEmployerCompany).toHaveBeenCalledWith(
        'usr_employer',
        'Nhà tuyển dụng chọn nhầm công ty',
        'impact-clean',
      )
    })
  })

  it('shows canonical blockers and never offers confirm for a used link', async () => {
    api.getEmployerCompanyUnlinkImpact.mockResolvedValue({
      can_apply: false,
      blockers: ['JOBS_EXIST'],
      counts: { company_documents: 0, company_update_requests: 0, campaigns: 0, jobs: 1 },
      impact_token: '',
    })
    const user = userEvent.setup()
    renderRecovery()

    await user.click(screen.getByRole('button', { name: /Gỡ liên kết$/ }))
    await user.type(screen.getByLabelText('Lý do xử lý'), 'Nhà tuyển dụng chọn nhầm công ty')
    await user.click(screen.getByRole('button', { name: 'Xem tác động' }))

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Đã có tin tuyển dụng')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Xác nhận gỡ liên kết' })).not.toBeInTheDocument()
    expect(api.unlinkEmployerCompany).not.toHaveBeenCalled()
  })
})
