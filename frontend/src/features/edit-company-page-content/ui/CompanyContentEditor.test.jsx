import { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withQueryClient } from '@/test/render-with-query-client'
import CompanyContentEditor from './CompanyContentEditor'

const { pageApi, profileApi, toast } = vi.hoisted(() => ({
  pageApi: {
    employerCompanyPageKeys: { page: ['employer', 'company', 'page', 'workspace'] },
    getEmployerCompanyPage: vi.fn(),
    submitEmployerCompanyPageContent: vi.fn(),
  },
  profileApi: {
    employerProfileKeys: { companyUpdateRequests: ['employer', 'company', 'update-requests'] },
    changeEmployerCompanyUpdateRequestLifecycle: vi.fn(),
    uploadEmployerCompanyCover: vi.fn(),
    uploadEmployerCompanyImage: vi.fn(),
    uploadEmployerCompanyLogo: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/entities/employer-company-page', () => pageApi)
vi.mock('@/entities/employer-profile', () => profileApi)
vi.mock('@/entities/job', () => ({
  jobKeys: { benefits: ['jobs', 'benefits'] },
  getJobBenefits: vi.fn().mockResolvedValue([{ id: 7, name: 'Bảo hiểm sức khoẻ' }, { id: 8, name: 'Laptop' }]),
}))
vi.mock('@/entities/location', () => ({ getProvinces: vi.fn().mockResolvedValue([{ id: 1, name: 'Hà Nội' }, { id: 2, name: 'Đà Nẵng' }]) }))
vi.mock('@/shared/lib/toast', () => ({ message: toast }))
vi.mock('@/shared/ui/RichTextEditor', () => ({
  default: ({ disabled, value = '', onChange, placeholder }) => (
    <textarea aria-label={placeholder} disabled={disabled} value={value} onChange={(event) => onChange?.(event.target.value)} />
  ),
}))

const CONTENT_FORM = {
  published: {
    headline: 'Khẩu hiệu cũ',
    description: '<p>Giới thiệu</p>',
    culture: '',
    employee_benefits: '',
    video_url: '',
    social_links: { facebook: 'https://facebook.com/acme', linkedin: '' },
    benefits: [{ benefit_id: 7, note: '' }],
    offices: [{ label: 'Trụ sở chính', address_line: '1 Duy Tân', province_id: 1, province_name: 'Hà Nội', is_headquarters: true }],
    logo_url: 'https://cdn.example/logo.png',
    cover_image_url: '',
    gallery: [{ id: 3, image_url: 'https://cdn.example/1.png', caption: '' }],
  },
  pending: null,
  request: null,
  section_status: {
    hero: 'published', about: 'published', benefits: 'published', culture: 'empty',
    gallery: 'published', video: 'empty', offices: 'published', social_links: 'published',
  },
}

const CONTENT_PAGE = {
  permissions: { can_view: true, can_edit_layout: true, can_edit_content: true, can_manage_editors: true, blockers: [] },
  registry: {
    sections: [],
    social_networks: [
      { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/…' },
      { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/…' },
    ],
    limits: { pinned_jobs: 3, benefits: 8, offices: 10, gallery: 10, headline: 160 },
  },
  content_form: CONTENT_FORM,
  completeness: {
    score: 60,
    items: [
      { key: 'logo', label: 'Logo', done: true },
      { key: 'cover', label: 'Ảnh bìa', done: false },
      { key: 'video', label: 'Video', done: false },
    ],
  },
}

function contentPage(overrides = {}) {
  return {
    ...CONTENT_PAGE,
    ...overrides,
    content_form: { ...CONTENT_FORM, ...overrides.content_form },
    permissions: { ...CONTENT_PAGE.permissions, ...overrides.permissions },
  }
}

const KEY = pageApi.employerCompanyPageKeys.page
const card = (title) => screen.getByRole('region', { name: title })
const httpError = (status, data) => Object.assign(new Error('failed'), { response: { status, data } })

function renderEditor(page = contentPage()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  client.setQueryData(KEY, page)
  const view = render(withQueryClient(<CompanyContentEditor page={page} />, client))
  return { ...view, client, rerenderPage: (next) => view.rerender(withQueryClient(<CompanyContentEditor page={next} />, client)) }
}

describe('CompanyContentEditor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows each card with its review status, prefilled from pending before published', () => {
    renderEditor(contentPage({
      content_form: {
        pending: { headline: 'Khẩu hiệu chờ duyệt' },
        request: { public_id: 'cur_1', status: 'changes_requested', submitted_at: '2026-11-10T03:00:00Z', review_note: 'Ảnh bìa bị mờ.', editable: true },
        section_status: { hero: 'changes_requested', about: 'pending', culture: 'empty' },
      },
    }))

    expect(within(card('Đầu trang')).getByText('Cần bổ sung')).toBeInTheDocument()
    expect(within(card('Đầu trang')).getByText('Quản trị viên yêu cầu bổ sung: Ảnh bìa bị mờ.')).toBeInTheDocument()
    expect(within(card('Đầu trang')).getByLabelText('Khẩu hiệu')).toHaveValue('Khẩu hiệu chờ duyệt')
    expect(within(card('Giới thiệu')).getByText('Chờ duyệt')).toBeInTheDocument()
    expect(within(card('Văn hoá')).getByText('Chưa có')).toBeInTheDocument()
    expect(within(card('Mạng xã hội')).getByLabelText('Facebook')).toHaveValue('https://facebook.com/acme')
    expect(screen.getByRole('region', { name: 'Yêu cầu cập nhật nội dung' })).toHaveTextContent('Cần bổ sung')
  })

  it('saves only the keys of the edited card and adopts the returned workspace', async () => {
    const user = userEvent.setup()
    const saved = contentPage({ content_form: { pending: { headline: 'Mới' }, section_status: { hero: 'pending' } } })
    pageApi.submitEmployerCompanyPageContent.mockResolvedValue(saved)
    const { client } = renderEditor()

    const hero = card('Đầu trang')
    expect(within(hero).getByRole('button', { name: 'Gửi duyệt Đầu trang' })).toBeDisabled()
    await user.clear(within(hero).getByLabelText('Khẩu hiệu'))
    await user.type(within(hero).getByLabelText('Khẩu hiệu'), '  Mới ')
    await user.click(within(hero).getByRole('button', { name: 'Gửi duyệt Đầu trang' }))

    await waitFor(() => expect(pageApi.submitEmployerCompanyPageContent).toHaveBeenCalledWith({ headline: 'Mới' }))
    expect(client.getQueryData(KEY)).toEqual(saved)
    expect(toast.success).toHaveBeenCalled()
  })

  it('sends the whole social links object and the office list in their own cards', async () => {
    const user = userEvent.setup()
    pageApi.submitEmployerCompanyPageContent.mockResolvedValue(contentPage())
    renderEditor()

    await user.type(within(card('Mạng xã hội')).getByLabelText('LinkedIn'), 'https://linkedin.com/company/acme')
    await user.click(within(card('Mạng xã hội')).getByRole('button', { name: 'Gửi duyệt Mạng xã hội' }))
    await waitFor(() => expect(pageApi.submitEmployerCompanyPageContent).toHaveBeenLastCalledWith({
      social_links: { facebook: 'https://facebook.com/acme', linkedin: 'https://linkedin.com/company/acme' },
    }))

    await user.clear(within(card('Văn phòng')).getByLabelText('Tên văn phòng'))
    await user.type(within(card('Văn phòng')).getByLabelText('Tên văn phòng'), 'Văn phòng Hà Nội')
    await user.click(within(card('Văn phòng')).getByRole('button', { name: 'Gửi duyệt Văn phòng' }))
    await waitFor(() => expect(pageApi.submitEmployerCompanyPageContent).toHaveBeenLastCalledWith({
      offices: [{ label: 'Văn phòng Hà Nội', address_line: '1 Duy Tân', province_id: 1, is_headquarters: true }],
    }))
  })

  it('validates the video link live and blocks unsupported hosts', async () => {
    const user = userEvent.setup()
    renderEditor()
    const video = card('Video')

    await user.type(within(video).getByLabelText('Liên kết video giới thiệu'), 'https://evil.example/v/1')
    expect(await within(video).findByText('Chỉ hỗ trợ liên kết video YouTube hoặc Vimeo.')).toBeInTheDocument()
    await user.click(within(video).getByRole('button', { name: 'Gửi duyệt Video' }))
    expect(pageApi.submitEmployerCompanyPageContent).not.toHaveBeenCalled()

    await user.clear(within(video).getByLabelText('Liên kết video giới thiệu'))
    await user.type(within(video).getByLabelText('Liên kết video giới thiệu'), 'https://youtu.be/dQw4w9WgXcQ')
    expect(await within(video).findByText('Video YouTube, mã dQw4w9WgXcQ.')).toBeInTheDocument()
  })

  it('maps 400 field errors onto the card fields', async () => {
    const user = userEvent.setup()
    pageApi.submitEmployerCompanyPageContent.mockRejectedValue(httpError(400, {
      offices: [{ address_line: ['Địa chỉ quá ngắn.'] }],
      non_field_errors: ['Có lỗi khác.'],
    }))
    renderEditor()

    await user.type(within(card('Văn phòng')).getByLabelText('Tên văn phòng'), ' 2')
    await user.click(within(card('Văn phòng')).getByRole('button', { name: 'Gửi duyệt Văn phòng' }))

    expect(await within(card('Văn phòng')).findByText('Địa chỉ quá ngắn.')).toBeInTheDocument()
    expect(within(card('Văn phòng')).getByText('Có lỗi khác.')).toBeInTheDocument()
  })

  it('reports an in-review conflict and a lost permission inside the card', async () => {
    const user = userEvent.setup()
    pageApi.submitEmployerCompanyPageContent
      .mockRejectedValueOnce(httpError(409, { code: 'COMPANY_UPDATE_IN_REVIEW', detail: 'Yêu cầu đang được thẩm định.' }))
      .mockRejectedValueOnce(httpError(403, { code: 'COMPANY_PAGE_EDIT_FORBIDDEN', detail: 'Bạn không còn quyền biên tập.' }))
    renderEditor()
    const hero = card('Đầu trang')

    await user.type(within(hero).getByLabelText('Khẩu hiệu'), '!')
    await user.click(within(hero).getByRole('button', { name: 'Gửi duyệt Đầu trang' }))
    expect(await within(hero).findByText('Yêu cầu đang được thẩm định.')).toBeInTheDocument()

    await user.click(within(hero).getByRole('button', { name: 'Gửi duyệt Đầu trang' }))
    expect(await within(hero).findByText('Bạn không còn quyền biên tập.')).toBeInTheDocument()
  })

  it('locks every card while the request is in review and hides withdrawal', () => {
    renderEditor(contentPage({
      content_form: { request: { public_id: 'cur_1', status: 'in_review', submitted_at: '2026-11-10T03:00:00Z', review_note: '', editable: false } },
    }))

    expect(screen.getByText(/Đang được thẩm định/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gửi duyệt/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rút yêu cầu' })).not.toBeInTheDocument()
    expect(within(card('Đầu trang')).getByLabelText('Khẩu hiệu')).toBeDisabled()
    expect(within(card('Giới thiệu')).getByRole('textbox')).toBeDisabled()
  })

  it('is read-only with the blocker reason for a viewer without content rights', () => {
    renderEditor(contentPage({
      permissions: { can_edit_content: false, blockers: [{ code: 'NO_GRANT', message: 'Bạn chưa được cấp quyền biên tập.' }] },
    }))

    expect(screen.getByText('Bạn chưa được cấp quyền biên tập.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gửi duyệt/ })).not.toBeInTheDocument()
  })

  it('uploads a new logo into the request returned by the marker POST', async () => {
    const user = userEvent.setup()
    const afterPost = contentPage({ content_form: { request: { public_id: 'cur_7', status: 'submitted', editable: true } } })
    pageApi.submitEmployerCompanyPageContent.mockResolvedValue(afterPost)
    pageApi.getEmployerCompanyPage.mockResolvedValue(afterPost)
    profileApi.uploadEmployerCompanyLogo.mockResolvedValue({})
    renderEditor()
    const hero = card('Đầu trang')

    const logo = new File(['logo'], 'logo.png', { type: 'image/png' })
    fireEvent.change(within(hero).getByLabelText('Chọn logo'), { target: { files: [logo] } })
    await user.click(within(hero).getByRole('button', { name: 'Gửi duyệt Đầu trang' }))

    await waitFor(() => expect(profileApi.uploadEmployerCompanyLogo).toHaveBeenCalledWith(logo, { updateRequest: 'cur_7' }))
    expect(pageApi.submitEmployerCompanyPageContent).toHaveBeenCalledWith({ logo_pending: true })
    expect(pageApi.getEmployerCompanyPage).toHaveBeenCalledTimes(1)
  })

  it('removes a published gallery image through gallery_deletions', async () => {
    const user = userEvent.setup()
    pageApi.submitEmployerCompanyPageContent.mockResolvedValue(contentPage())
    renderEditor()
    const gallery = card('Thư viện ảnh')

    await user.click(within(gallery).getByRole('button', { name: 'Xoá ảnh 3' }))
    expect(within(gallery).getByText('Sẽ xoá')).toBeInTheDocument()
    await user.click(within(gallery).getByRole('button', { name: 'Gửi duyệt Thư viện ảnh' }))

    await waitFor(() => expect(pageApi.submitEmployerCompanyPageContent).toHaveBeenCalledWith({ gallery_deletions: [3] }))
    expect(profileApi.uploadEmployerCompanyImage).not.toHaveBeenCalled()
  })

  it('withdraws the request after confirmation', async () => {
    const user = userEvent.setup()
    profileApi.changeEmployerCompanyUpdateRequestLifecycle.mockResolvedValue({ status: 'withdrawn' })
    renderEditor(contentPage({
      content_form: { request: { public_id: 'cur_1', status: 'submitted', submitted_at: '2026-11-10T03:00:00Z', review_note: '', editable: true } },
    }))

    await user.click(screen.getByRole('button', { name: 'Rút yêu cầu' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rút yêu cầu' }))

    await waitFor(() => expect(profileApi.changeEmployerCompanyUpdateRequestLifecycle).toHaveBeenCalledWith('cur_1', 'withdraw', {}))
  })
})
