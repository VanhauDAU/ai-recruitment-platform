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

vi.mock('@/entities/account/admin-account', () => api)
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

  it('shows the impact on open and confirms a clean link in one click', async () => {
    api.getEmployerCompanyUnlinkImpact.mockResolvedValue({
      can_apply: true,
      blockers: [],
      withdrawals: ['VERIFICATION_DOCUMENTS'],
      counts: { active_jobs: 0, open_campaigns: 0, other_members: 0, recruitment_needs: 1 },
      impact_token: 'impact-clean',
    })
    api.unlinkEmployerCompany.mockResolvedValue({ context: { company: null } })
    const user = userEvent.setup()
    renderRecovery()

    await user.click(screen.getByRole('button', { name: /Gỡ liên kết$/ }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Tự rút: Giấy tờ xác thực chưa duyệt')).toBeInTheDocument()
    expect(api.getEmployerCompanyUnlinkImpact).toHaveBeenCalledWith('usr_employer', '')
    await user.type(screen.getByLabelText('Lý do xử lý'), 'Nhà tuyển dụng chọn nhầm công ty')
    await user.click(within(dialog).getByRole('button', { name: 'Gỡ liên kết' }))

    await waitFor(() => {
      expect(api.unlinkEmployerCompany).toHaveBeenCalledWith(
        'usr_employer',
        'Nhà tuyển dụng chọn nhầm công ty',
        'impact-clean',
      )
    })
  })

  it('shows what blocks the unlink with the step to undo it and disables confirm', async () => {
    api.getEmployerCompanyUnlinkImpact.mockResolvedValue({
      can_apply: false,
      blockers: ['ACTIVE_JOBS_EXIST'],
      withdrawals: [],
      counts: { active_jobs: 1, open_campaigns: 0, other_members: 0, recruitment_needs: 0 },
      impact_token: '',
    })
    const user = userEvent.setup()
    renderRecovery()

    await user.click(screen.getByRole('button', { name: /Gỡ liên kết$/ }))

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Còn tin đang tuyển: đóng các tin trước')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Gỡ liên kết' })).toBeDisabled()
    expect(api.unlinkEmployerCompany).not.toHaveBeenCalled()
  })
})
