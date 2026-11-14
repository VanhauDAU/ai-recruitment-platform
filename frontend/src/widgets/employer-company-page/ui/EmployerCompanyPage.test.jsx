import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withQueryClient } from '@/test/render-with-query-client'
import EmployerCompanyPage from './EmployerCompanyPage'

const api = vi.hoisted(() => ({
  employerCompanyPageKeys: {
    page: ['employer', 'company', 'page', 'workspace'],
    editors: ['employer', 'company', 'page', 'editors'],
    pinnableJobs: (q) => ['employer', 'company', 'page', 'pinnable-jobs', { q }],
  },
  getEmployerCompanyPage: vi.fn(),
  getEmployerCompanyPageEditors: vi.fn(),
  getEmployerPinnableJobs: vi.fn(),
  grantEmployerCompanyPageEditor: vi.fn(),
  revokeEmployerCompanyPageEditor: vi.fn(),
  updateEmployerCompanyPageLayout: vi.fn(),
}))

vi.mock('@/entities/employer-company-page', () => api)
vi.mock('@/entities/job', () => ({ jobKeys: { benefits: ['jobs', 'benefits'] }, getJobBenefits: vi.fn().mockResolvedValue([]) }))
// Tab "Nội dung" có test riêng; ở đây chỉ kiểm tra widget mở đúng thẻ được chọn.
vi.mock('@/features/edit-company-page-content', async (importOriginal) => ({
  ...(await importOriginal()),
  CompanyContentEditor: ({ focusCard }) => <p>Trình sửa nội dung{focusCard ? ` → ${focusCard.id}` : ''}</p>,
}))

const OWNER_PERMISSIONS = { can_view: true, can_edit_layout: true, can_edit_content: true, can_manage_editors: true, blockers: [] }
const PAGE = {
  company: { public_id: 'co_1', slug: 'acme', display_name: 'ACME Việt Nam', public_path: '/cong-ty/acme', is_public: true, is_indexable: false },
  permissions: OWNER_PERMISSIONS,
  registry: {
    sections: [
      { key: 'about', title: 'Giới thiệu công ty', zone: 'main', always_on: false },
      { key: 'jobs', title: 'Việc làm đang tuyển', zone: 'main', always_on: true },
      { key: 'benefits', title: 'Phúc lợi', zone: 'main', always_on: false },
      { key: 'general_info', title: 'Thông tin chung', zone: 'sidebar', always_on: true },
    ],
    accents: [
      { key: 'brand', label: 'Xanh ProCV', primary: '#00b14f', hover: '#008a3e', soft: '#f0fbf5' },
      { key: 'ocean', label: 'Xanh biển', primary: '#0b6bcb', hover: '#084f96', soft: '#eef6ff' },
    ],
    limits: { pinned_jobs: 3 },
  },
  layout: { section_order: ['about', 'jobs', 'benefits'], hidden_sections: [], accent: 'brand', pinned_job_public_ids: ['jb_1'], lock_version: 2 },
  pinned_jobs: [{ public_id: 'jb_1', title: 'Kế toán trưởng', slug: 'ke-toan-truong', published_at: '2026-11-01T02:00:00Z' }],
  content: {
    public_id: 'co_1',
    slug: 'acme',
    identity: { display_name: 'ACME Việt Nam', legal_name: '', logo_url: '', cover_image_url: '', website_url: '', industries: [] },
    stats: { active_public_job_count: 5, follower_count: 12 },
    theme: { accent: { key: 'brand', primary: '#00b14f', hover: '#008a3e', soft: '#f0fbf5' } },
    sections: [
      { key: 'about', type: 'rich_text', title: 'Giới thiệu công ty', body_html: '<p>Chúng tôi làm phần mềm.</p>' },
      { key: 'jobs', type: 'jobs', title: 'Việc làm đang tuyển' },
    ],
    sidebar: [{ key: 'general_info', type: 'facts', title: 'Thông tin chung', items: [{ key: 'company_size', label: 'Quy mô', value: '25 - 99 nhân viên' }] }],
  },
  stats: { follower_count: 1200, active_public_job_count: 5 },
}

const CONTENT_FORM = {
  published: { headline: '', social_links: {}, benefits: [], offices: [], gallery: [] },
  pending: { headline: 'Khẩu hiệu chờ duyệt' },
  request: { public_id: 'cur_1', status: 'submitted', submitted_at: '2026-11-10T03:00:00Z', review_note: '', editable: true },
  section_status: { hero: 'pending' },
}
const COMPLETENESS = {
  score: 40,
  items: [
    { key: 'logo', label: 'Logo', done: true },
    { key: 'video', label: 'Video', done: false },
  ],
}

function pageWith(permissions) {
  return { ...PAGE, permissions: { ...OWNER_PERMISSIONS, ...permissions } }
}

function renderWorkspace(page = PAGE) {
  api.getEmployerCompanyPage.mockResolvedValue(page)
  render(withQueryClient(<MemoryRouter><EmployerCompanyPage /></MemoryRouter>))
}

describe('EmployerCompanyPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a skeleton, then the header with totals and the public page link', async () => {
    renderWorkspace()
    expect(screen.getByLabelText('Đang tải trang công ty')).toBeInTheDocument()

    expect(await screen.findByRole('heading', { level: 1, name: 'Trang công ty' })).toBeInTheDocument()
    expect(screen.getByText('ACME Việt Nam')).toBeInTheDocument()
    const stats = screen.getByRole('list', { name: 'Số liệu trang công ty' })
    expect(stats).toHaveTextContent('1.200 người theo dõi')
    expect(stats).toHaveTextContent('5 việc làm đang tuyển')
    const link = screen.getByRole('link', { name: /Xem trang công khai/ })
    expect(link).toHaveAttribute('href', '/cong-ty/acme')
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Bố cục', 'Người biên tập'])
  })

  it('is read-only with the blocker reason and a verification link when the owner is not verified', async () => {
    const message = 'Chủ sở hữu công ty cần hoàn tất xác thực trước khi tuỳ biến trang.'
    renderWorkspace(pageWith({
      can_edit_layout: false,
      can_edit_content: false,
      can_manage_editors: false,
      blockers: [{ code: 'OWNER_NOT_VERIFIED', message }],
    }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('link', { name: 'Xác thực tài khoản' })).toHaveAttribute('href', '/tuyendung/app/employer-verify')
    expect(screen.getAllByText(message)).toHaveLength(2)
    screen.getAllByRole('switch').forEach((control) => expect(control).toBeDisabled())
    screen.getAllByRole('radio').forEach((control) => expect(control).toBeDisabled())
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Người biên tập' })).not.toBeInTheDocument()
  })

  it('explains a missing grant without offering the verification link', async () => {
    renderWorkspace(pageWith({
      can_edit_layout: false,
      can_manage_editors: false,
      blockers: [{ code: 'NO_GRANT', message: 'Bạn chưa được chủ sở hữu cấp quyền biên tập trang công ty.' }],
    }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn chưa được chủ sở hữu cấp quyền biên tập')
    expect(screen.queryByRole('link', { name: 'Xác thực tài khoản' })).not.toBeInTheDocument()
  })

  it('lets a granted editor change and save the layout but hides editor management', async () => {
    const user = userEvent.setup()
    api.updateEmployerCompanyPageLayout.mockResolvedValue({
      ...pageWith({ can_manage_editors: false }),
      layout: { ...PAGE.layout, hidden_sections: ['about'], lock_version: 3 },
    })
    renderWorkspace(pageWith({ can_manage_editors: false }))

    const save = await screen.findByRole('button', { name: 'Lưu thay đổi' })
    expect(save).toBeDisabled()
    expect(screen.queryByRole('tab', { name: 'Người biên tập' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: 'Hiển thị Giới thiệu công ty' }))
    await user.click(save)

    expect(await screen.findByText('Bố cục đang khớp với trang công khai.')).toBeInTheDocument()
    expect(api.updateEmployerCompanyPageLayout.mock.calls[0][0]).toEqual({ lock_version: 2, hidden_sections: ['about'] })
    expect(screen.getByRole('switch', { name: 'Hiển thị Giới thiệu công ty' })).not.toBeChecked()
  })

  it('loads the member roster only when the owner opens the editors tab', async () => {
    const user = userEvent.setup()
    api.getEmployerCompanyPageEditors.mockResolvedValue([
      { member_id: 'm1', display_name: 'Nguyễn An', position_title: 'HR', email_masked: 'a***@acme.vn', company_role: 'member', eligible: true, grant: null },
    ])
    renderWorkspace()

    await user.click(await screen.findByRole('tab', { name: 'Người biên tập' }))

    expect(await screen.findByRole('button', { name: 'Cấp quyền biên tập cho Nguyễn An' })).toBeEnabled()
    expect(api.getEmployerCompanyPageEditors).toHaveBeenCalledTimes(1)
  })

  it('previews the unsaved draft exactly as the public page would render it', async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByRole('button', { name: /Xem trước/ }))
    const preview = await screen.findByRole('dialog')
    expect(await within(preview).findByRole('region', { name: 'Giới thiệu công ty' })).toBeInTheDocument()
    expect(within(preview).getByRole('list', { name: 'Tin ghim trong bản xem trước' })).toHaveTextContent('Nổi bật Kế toán trưởng')

    await user.click(within(preview).getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('switch', { name: 'Hiển thị Giới thiệu công ty' }))
    await user.click(screen.getByRole('button', { name: /Xem trước/ }))

    const updated = await screen.findByRole('dialog')
    expect(await within(updated).findByRole('region', { name: 'Việc làm đang tuyển' })).toBeInTheDocument()
    expect(within(updated).queryByRole('region', { name: 'Giới thiệu công ty' })).not.toBeInTheDocument()
  })

  it('adds the content tab between layout and editors and opens a card from the completeness meter', async () => {
    const user = userEvent.setup()
    renderWorkspace({ ...PAGE, content_form: CONTENT_FORM, completeness: COMPLETENESS })

    expect((await screen.findAllByRole('tab')).map((tab) => tab.textContent)).toEqual(['Bố cục', 'Nội dung', 'Người biên tập'])
    const meter = screen.getByRole('region', { name: 'Độ hoàn thiện trang công ty' })
    expect(within(meter).getByRole('progressbar', { name: 'Độ hoàn thiện' })).toHaveAttribute('aria-valuenow', '40')
    expect(meter).toHaveTextContent('40%hoàn thiện · 1/2 mục')

    await user.click(within(meter).getByText('Còn 1 mục nên bổ sung'))
    await user.click(within(meter).getByRole('button', { name: 'Bổ sung video' }))

    expect(screen.getByRole('tab', { name: 'Nội dung' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Trình sửa nội dung → company-content-video')).toBeInTheDocument()
  })

  it('overlays the pending content on the preview only when asked', async () => {
    const user = userEvent.setup()
    renderWorkspace({ ...PAGE, content_form: CONTENT_FORM, completeness: COMPLETENESS })

    await user.click(await screen.findByRole('button', { name: /Xem trước/ }))
    const preview = await screen.findByRole('dialog')
    await within(preview).findByRole('region', { name: 'Giới thiệu công ty' })
    expect(within(preview).queryByText('Khẩu hiệu chờ duyệt')).not.toBeInTheDocument()

    await user.click(within(preview).getByRole('switch', { name: 'Xem bản đang chờ duyệt' }))

    expect(await within(preview).findByText('Khẩu hiệu chờ duyệt')).toBeInTheDocument()
  })

  it('points an employer without a company to company settings', async () => {
    api.getEmployerCompanyPage.mockRejectedValue(Object.assign(new Error('not found'), { response: { status: 404 } }))
    render(withQueryClient(<MemoryRouter><EmployerCompanyPage /></MemoryRouter>))

    expect(await screen.findByText(/chưa liên kết với công ty nào/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cập nhật thông tin công ty' })).toHaveAttribute('href', '/tuyendung/app/account/settings/company')
    expect(api.getEmployerCompanyPage).toHaveBeenCalledTimes(1)
  })

  it('offers a retry when the workspace fails to load', async () => {
    const user = userEvent.setup()
    api.getEmployerCompanyPage.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { response: { status: 403 } }))
    api.getEmployerCompanyPage.mockResolvedValue(PAGE)
    render(withQueryClient(<MemoryRouter><EmployerCompanyPage /></MemoryRouter>))

    await user.click(await screen.findByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Trang công ty' })).toBeInTheDocument()
  })
})
