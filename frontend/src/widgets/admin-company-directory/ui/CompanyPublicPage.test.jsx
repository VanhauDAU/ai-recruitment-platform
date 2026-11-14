import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCompanyDetail from './AdminCompanyDetail'

const { api, toast, useSession } = vi.hoisted(() => ({
  api: {
    getAdminCompany: vi.fn(),
    getAdminCompanyPublicPage: vi.fn(),
    setAdminCompanyPolicyHold: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
  useSession: vi.fn(),
}))

vi.mock('@/entities/admin-company', async (importOriginal) => ({
  ...await importOriginal(),
  ...api,
}))
vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/shared/lib/toast', () => ({ message: toast }))

const COMPANY = {
  public_id: 'co_alpha',
  company_name: 'Công ty Alpha',
  trade_name: 'Alpha',
  recruiter_count: 1,
  owner_count: 1,
  member_count: 0,
  pending_update_count: 0,
  recruiter_verification_summary: {},
  industries: [],
}

const PROFILE = {
  public_id: 'co_alpha',
  slug: 'alpha',
  canonical_path: '/cong-ty/alpha',
  indexable: true,
  identity: { display_name: 'Alpha', legal_name: 'Công ty Alpha', logo_url: '', cover_image_url: '', website_url: '', industries: [] },
  stats: { active_public_job_count: 2, company_size: '', company_size_display: '', founded_year: null },
  theme: { accent: { key: 'brand', primary: '#00b14f', hover: '#008a3e', soft: '#f0fbf5' } },
  sections: [
    { key: 'about', type: 'rich_text', title: 'Giới thiệu công ty', body_html: '<p>Alpha làm phần mềm.</p>' },
    { key: 'jobs', type: 'jobs', title: 'Việc làm đang tuyển' },
  ],
  sidebar: [
    { key: 'share', type: 'share', title: 'Chia sẻ công ty' },
    { key: 'similar_companies', type: 'similar_companies', title: 'Công ty cùng lĩnh vực' },
  ],
}

function publicPage(hold = {}) {
  return {
    public_path: '/cong-ty/alpha',
    is_indexable: true,
    policy_hold: { active: false, reason: '', actor_name: '', at: null, ...hold },
    profile: PROFILE,
  }
}

function renderTab({ permissions = ['company.view'], tab = 'public-page' } = {}) {
  useSession.mockReturnValue({
    user: { role: 'admin', admin_access: { is_superuser: false, permissions, memberships: [] } },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/app/companies/co_alpha${tab ? `?tab=${tab}` : ''}`]}>
        <AdminCompanyDetail publicId="co_alpha" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('admin company public page tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getAdminCompany.mockResolvedValue(COMPANY)
    api.getAdminCompanyPublicPage.mockResolvedValue(publicPage())
  })

  it('loads the preview only when the tab is opened', async () => {
    const user = userEvent.setup()
    renderTab({ tab: '' })

    const tab = await screen.findByRole('tab', { name: 'Trang công khai' })
    expect(api.getAdminCompanyPublicPage).not.toHaveBeenCalled()

    await user.click(tab)
    expect(await screen.findByText('Đang hiển thị')).toBeVisible()
    expect(api.getAdminCompanyPublicPage).toHaveBeenCalledWith(
      'co_alpha',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('previews the public profile read-only and hides hold controls without the moderate permission', async () => {
    renderTab()

    expect(await screen.findByText('Đang hiển thị')).toBeVisible()
    expect(screen.getByText('Được index')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Mở trang công khai' })).toHaveAttribute('href', '/cong-ty/alpha')
    expect(await screen.findByRole('heading', { level: 2, name: 'Alpha' })).toBeVisible()
    expect(screen.getByText('Alpha làm phần mềm.')).toBeVisible()
    expect(screen.getByText('Danh sách việc làm đang tuyển hiển thị tại đây trên trang công khai.')).toBeVisible()
    expect(screen.getByText('Công ty cùng lĩnh vực được gợi ý trên trang công khai.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Sao chép đường dẫn' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

    expect(screen.queryByRole('button', { name: 'Tạm ẩn trang' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Khôi phục hiển thị' })).not.toBeInTheDocument()
  })

  it('requires a reason of at least ten characters before applying a hold', async () => {
    const user = userEvent.setup()
    const held = publicPage({
      active: true,
      reason: 'Giả mạo thương hiệu khác',
      actor_name: 'Nguyễn Quản Trị',
      at: '2026-11-14T03:00:00Z',
    })
    api.setAdminCompanyPolicyHold.mockResolvedValue({ ...held, is_indexable: false })
    renderTab({ permissions: ['company.view', 'company_page.moderate'] })

    await user.click(await screen.findByRole('button', { name: 'Tạm ẩn trang' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tạm ẩn trang công ty' })
    expect(within(dialog).getByText(/Trang của Công ty Alpha sẽ trả 404/)).toBeInTheDocument()

    const reason = within(dialog).getByRole('textbox', { name: 'Lý do tạm ẩn' })
    await user.type(reason, '  quá ngắn ')
    await user.click(within(dialog).getByRole('button', { name: 'Tạm ẩn trang' }))
    expect(await within(dialog).findByText('Nhập lý do từ 10 đến 500 ký tự.')).toBeInTheDocument()
    expect(api.setAdminCompanyPolicyHold).not.toHaveBeenCalled()

    await user.clear(reason)
    await user.type(reason, '  Giả mạo thương hiệu khác  ')
    await user.click(within(dialog).getByRole('button', { name: 'Tạm ẩn trang' }))

    await waitFor(() => expect(api.setAdminCompanyPolicyHold).toHaveBeenCalledWith('co_alpha', {
      action: 'apply',
      reason: 'Giả mạo thương hiệu khác',
    }))
    expect(await screen.findByText('Đang tạm ẩn')).toBeVisible()
    expect(screen.getByText('Không index')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent(/tạm ẩn bởi Nguyễn Quản Trị\. Lý do: Giả mạo thương hiệu khác/)
    expect(screen.queryByRole('link', { name: 'Mở trang công khai' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Khôi phục hiển thị' })).toBeVisible()
    expect(toast.success).toHaveBeenCalledWith('Đã tạm ẩn trang công ty khỏi các bề mặt công khai.')
    expect(api.getAdminCompanyPublicPage).toHaveBeenCalledOnce()
  })

  it('releases a hold with a reason and keeps the dialog open when the API refuses', async () => {
    const user = userEvent.setup()
    api.getAdminCompanyPublicPage.mockResolvedValue(publicPage({
      active: true,
      reason: 'Giả mạo thương hiệu khác',
      actor_name: 'Nguyễn Quản Trị',
      at: '2026-11-14T03:00:00Z',
    }))
    api.setAdminCompanyPolicyHold
      .mockRejectedValueOnce({ response: { status: 403, data: { detail: 'Bạn không có quyền thực hiện thao tác này.' } } })
      .mockResolvedValueOnce(publicPage())
    renderTab({ permissions: ['company.view', 'company_page.moderate'] })

    await user.click(await screen.findByRole('button', { name: 'Khôi phục hiển thị' }))
    const dialog = await screen.findByRole('dialog', { name: 'Khôi phục trang công ty' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Lý do khôi phục' }), 'Công ty đã bổ sung giấy tờ hợp lệ')
    await user.click(within(dialog).getByRole('button', { name: 'Khôi phục hiển thị' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByText('Đang tạm ẩn')).toBeVisible()
    expect(within(dialog).getByRole('textbox', { name: 'Lý do khôi phục' })).toHaveValue('Công ty đã bổ sung giấy tờ hợp lệ')

    await user.click(within(dialog).getByRole('button', { name: 'Khôi phục hiển thị' }))
    await waitFor(() => expect(api.setAdminCompanyPolicyHold).toHaveBeenLastCalledWith('co_alpha', {
      action: 'release',
      reason: 'Công ty đã bổ sung giấy tờ hợp lệ',
    }))
    expect(await screen.findByText('Đang hiển thị')).toBeVisible()
    expect(toast.success).toHaveBeenCalledWith('Đã khôi phục hiển thị trang công ty.')
  })

  it('reports a failed preview request with a retry', async () => {
    const user = userEvent.setup()
    api.getAdminCompanyPublicPage
      .mockRejectedValueOnce({ response: { status: 500, data: {} } })
      .mockResolvedValueOnce(publicPage())
    renderTab()

    expect(await screen.findByRole('alert')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Đang hiển thị')).toBeVisible()
  })
})
