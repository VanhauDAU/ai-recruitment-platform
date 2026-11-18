import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCompanyJoinRequests,
  getCompanyMembers,
  getFormerCompanyMembers,
  handOverCompanyResources,
  removeCompanyMember,
  transferCompanyOwnership,
} from '@/entities/account/employer-profile'
import { withQueryClient } from '@/test/render-with-query-client'
import CompanyMembersPanel from './CompanyMembersPanel'

vi.mock('@/entities/account/employer-profile', async (importOriginal) => ({
  ...(await importOriginal()),
  getCompanyJoinRequests: vi.fn(),
  getCompanyMembers: vi.fn(),
  getFormerCompanyMembers: vi.fn(),
  handOverCompanyResources: vi.fn(),
  removeCompanyMember: vi.fn(),
  transferCompanyOwnership: vi.fn(),
}))

const base = {
  avatar_url: '', email_masked: 'ha***@acme.vn', phone_masked: '090****123', position_title: 'Recruiter',
  verification_status: 'approved', verification_label: 'Đã xác thực', is_verified: true, has_compliance_hold: false,
  page_editor_grant_id: null, joined_at: '2026-11-10T02:00:00Z', approved_by_name: 'Chủ A',
  job_count: 0, active_job_count: 0, unanswered_application_count: 0, open_campaign_count: 0, is_me: false,
  can_transfer: true, can_grant_page_editor: true, can_receive_jobs: true, removal_blockers: [],
}
const MEMBERS = [
  { ...base, member_id: 'own_1', display_name: 'Chủ A', role: 'manager', role_label: 'Quản lý công ty', is_me: true, can_transfer: false, removal_blockers: ['Hãy chuyển quyền quản lý trước khi rời vai trò này'] },
  { ...base, member_id: 'mem_1', display_name: 'Phạm Thu Hà', role: 'member', role_label: 'Thành viên', active_job_count: 2 },
  { ...base, member_id: 'mem_2', display_name: 'Đỗ Khoa', role: 'member', role_label: 'Thành viên', is_verified: false, verification_status: '', verification_label: 'Chưa nộp hồ sơ xác thực', can_transfer: false },
]

async function openMenu(name) {
  await userEvent.click(await screen.findByRole('button', { name: `Quản lý ${name}` }))
  return screen.findByRole('menu')
}

describe('company members tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCompanyJoinRequests.mockResolvedValue([])
    getCompanyMembers.mockResolvedValue(MEMBERS)
    getFormerCompanyMembers.mockResolvedValue([])
  })

  it('shows roles in plain words, verification and recruiting activity', async () => {
    render(withQueryClient(<CompanyMembersPanel />))

    expect(await screen.findByText('Quản lý công ty')).toBeInTheDocument()
    expect(screen.queryByText(/owner/i)).not.toBeInTheDocument()
    expect(screen.getByText('3 thành viên · 2 đã xác thực tài khoản')).toBeInTheDocument()
    expect(screen.getByText('Chưa nộp hồ sơ xác thực')).toBeInTheDocument()
    expect(screen.getAllByText('tin đang tuyển', { exact: false }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Quản lý Chủ A' })).not.toBeInTheDocument()
  })

  it('transfers the manager role to a verified member after confirmation', async () => {
    transferCompanyOwnership.mockResolvedValue()
    const onRefresh = vi.fn()
    render(withQueryClient(<CompanyMembersPanel onRefresh={onRefresh} />))

    const menu = await openMenu('Phạm Thu Hà')
    await userEvent.click(within(menu).getByText('Chuyển quyền quản lý công ty'))
    await userEvent.click(await screen.findByRole('button', { name: 'Chuyển quyền' }))

    await waitFor(() => expect(transferCompanyOwnership).toHaveBeenCalledWith('mem_1'))
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
  })

  it('removes a member with a reason', async () => {
    removeCompanyMember.mockResolvedValue()
    render(withQueryClient(<CompanyMembersPanel />))

    const menu = await openMenu('Đỗ Khoa')
    await userEvent.click(within(menu).getByText('Gỡ khỏi công ty'))
    await userEvent.type(await screen.findByLabelText('Lý do gỡ thành viên'), 'Đã nghỉ việc')
    await userEvent.click(screen.getByRole('button', { name: 'Gỡ khỏi công ty' }))

    await waitFor(() => expect(removeCompanyMember).toHaveBeenCalledWith('mem_2', 'Đã nghỉ việc'))
  })

  it('hands the jobs of a former member to a verified member', async () => {
    getFormerCompanyMembers.mockResolvedValue([{
      member_id: 'old_1', display_name: 'Lý Cũ', avatar_url: '', left_at: '2026-11-12T02:00:00Z',
      job_count: 3, active_job_count: 1, unanswered_application_count: 4, open_campaign_count: 0,
    }])
    handOverCompanyResources.mockResolvedValue({ job_count: 3, campaign_count: 0 })
    render(withQueryClient(<CompanyMembersPanel />))

    expect(await screen.findByText(/3 tin \(1 đang tuyển\) · 4 hồ sơ chờ phản hồi/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp quản' }))
    await userEvent.click(await screen.findByLabelText('Chọn người nhận tin tuyển dụng'))
    await userEvent.click(await screen.findByTitle(/Phạm Thu Hà/))
    await userEvent.click(screen.getByRole('button', { name: 'Giao tin' }))

    await waitFor(() => expect(handOverCompanyResources).toHaveBeenCalledWith('old_1', 'mem_1'))
  })
})
