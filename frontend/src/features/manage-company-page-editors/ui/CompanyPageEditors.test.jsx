import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withQueryClient } from '@/test/render-with-query-client'
import CompanyPageEditors from './CompanyPageEditors'

const { api, toast } = vi.hoisted(() => ({
  api: {
    employerCompanyPageKeys: { editors: ['employer', 'company', 'page', 'editors'] },
    getEmployerCompanyPageEditors: vi.fn(),
    grantEmployerCompanyPageEditor: vi.fn(),
    revokeEmployerCompanyPageEditor: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/entities/employer-company-page', () => api)
vi.mock('@/shared/lib/toast', () => ({ message: toast }))

const GRANT = { public_id: 'cpg_1', granted_at: '2026-11-10T03:00:00Z', granted_by_name: 'Trần Chủ', effective: true }
const OWNER = { member_id: 'rec_owner', display_name: 'Trần Chủ', position_title: 'Giám đốc', email_masked: 't***@acme.vn', company_role: 'owner', eligible: true, grant: null }
const VERIFIED = { member_id: 'rec_an', display_name: 'Nguyễn An', position_title: 'HR', email_masked: 'a***@acme.vn', company_role: 'member', eligible: true, grant: null }
const UNVERIFIED = { member_id: 'm_binh', display_name: 'Lê Bình', position_title: '', email_masked: 'b***@acme.vn', company_role: 'member', eligible: false, grant: null }
const EDITOR = { member_id: 'm_chi', display_name: 'Phạm Chi', position_title: 'HR', email_masked: 'c***@acme.vn', company_role: 'member', eligible: true, grant: GRANT }
const NAMELESS = { member_id: 'rec_e', display_name: '', position_title: '', email_masked: 'e***@acme.vn', company_role: 'member', eligible: true, grant: null }
const LAPSED = { member_id: 'm_dung', display_name: 'Vũ Dũng', position_title: 'HR', email_masked: 'd***@acme.vn', company_role: 'member', eligible: false, grant: { ...GRANT, public_id: 'cpg_2', effective: false } }

const row = (name) => screen.getByText(name).closest('li')

async function renderRoster(members = [OWNER, VERIFIED, UNVERIFIED, EDITOR, LAPSED]) {
  api.getEmployerCompanyPageEditors.mockResolvedValue(members)
  render(withQueryClient(<CompanyPageEditors />))
  await screen.findByRole('list', { name: 'Thành viên công ty' })
}

describe('CompanyPageEditors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the owner without actions, eligibility and grant states', async () => {
    await renderRoster()

    expect(within(row('Trần Chủ')).getByText('Chủ sở hữu')).toBeInTheDocument()
    expect(within(row('Trần Chủ')).queryByRole('button')).not.toBeInTheDocument()
    expect(within(row('Lê Bình')).getByText('Chưa xác thực')).toBeInTheDocument()
    expect(within(row('Lê Bình')).getByRole('button', { name: 'Cấp quyền biên tập cho Lê Bình' })).toBeDisabled()
    expect(within(row('Phạm Chi')).getByText('Đang hiệu lực')).toBeInTheDocument()
    expect(within(row('Phạm Chi')).getByText(/bởi Trần Chủ/)).toBeInTheDocument()
    expect(within(row('Vũ Dũng')).getByText('Tạm mất hiệu lực')).toBeInTheDocument()
    expect(within(row('Vũ Dũng')).getByRole('button', { name: 'Thu hồi quyền biên tập của Vũ Dũng' })).toBeEnabled()
  })

  it('grants editing to a verified member and updates the row in place', async () => {
    const user = userEvent.setup()
    api.grantEmployerCompanyPageEditor.mockResolvedValue({ ...VERIFIED, grant: GRANT })
    await renderRoster()

    await user.click(screen.getByRole('button', { name: 'Cấp quyền biên tập cho Nguyễn An' }))

    expect(await within(row('Nguyễn An')).findByText('Đang hiệu lực')).toBeInTheDocument()
    expect(api.grantEmployerCompanyPageEditor.mock.calls[0][0]).toBe('rec_an')
    expect(api.getEmployerCompanyPageEditors).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Đã cấp quyền biên tập cho Nguyễn An.')
  })

  it('falls back to the masked email when a member has no display name', async () => {
    await renderRoster([OWNER, NAMELESS])

    expect(screen.getByRole('button', { name: 'Cấp quyền biên tập cho e***@acme.vn' })).toBeEnabled()
  })

  it('reloads the roster when the grant target vanished (404)', async () => {
    const user = userEvent.setup()
    api.grantEmployerCompanyPageEditor.mockRejectedValue(Object.assign(new Error('Not found.'), { response: { status: 404, data: { detail: 'Không tìm thấy thành viên.' } } }))
    await renderRoster()

    await user.click(screen.getByRole('button', { name: 'Cấp quyền biên tập cho Nguyễn An' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Không tìm thấy thành viên.'))
    expect(api.getEmployerCompanyPageEditors).toHaveBeenCalledTimes(2)
  })

  it('reports a rejected grant with the server reason and reloads the roster', async () => {
    const user = userEvent.setup()
    api.grantEmployerCompanyPageEditor.mockRejectedValue(Object.assign(new Error('bad request'), {
      response: { status: 400, data: { code: 'EDITOR_NOT_VERIFIED', detail: 'Thành viên chưa được xác thực.' } },
    }))
    await renderRoster()

    await user.click(screen.getByRole('button', { name: 'Cấp quyền biên tập cho Nguyễn An' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Thành viên chưa được xác thực.'))
    expect(api.getEmployerCompanyPageEditors).toHaveBeenCalledTimes(2)
  })

  it('revokes a grant only after confirmation', async () => {
    const user = userEvent.setup()
    api.revokeEmployerCompanyPageEditor.mockResolvedValue({ ...EDITOR, grant: null })
    await renderRoster()

    await user.click(screen.getByRole('button', { name: 'Thu hồi quyền biên tập của Phạm Chi' }))
    expect(api.revokeEmployerCompanyPageEditor).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Phạm Chi sẽ không còn tuỳ biến được trang công ty/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Thu hồi' }))

    expect(await within(row('Phạm Chi')).findByRole('button', { name: 'Cấp quyền biên tập cho Phạm Chi' })).toBeEnabled()
    expect(api.revokeEmployerCompanyPageEditor).toHaveBeenCalledWith('cpg_1')
    expect(within(row('Phạm Chi')).queryByText('Đang hiệu lực')).not.toBeInTheDocument()
  })
})
