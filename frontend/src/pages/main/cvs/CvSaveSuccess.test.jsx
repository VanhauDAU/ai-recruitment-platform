import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CvSaveSuccess from './CvSaveSuccess'

const mocks = vi.hoisted(() => ({
  getCv: vi.fn(), getCvVersion: vi.fn(), getCvJobRecommendations: vi.fn(),
  toBlob: vi.fn(),
  getRecruiterVisibility: vi.fn(), updateRecruiterVisibility: vi.fn(),
  createCvPdfExport: vi.fn(), downloadCvPdf: vi.fn(), getCvPdfExport: vi.fn(), retryCvPdfExport: vi.fn(),
}))

vi.mock('@/entities/cv', () => ({
  getCv: mocks.getCv,
  getCvVersion: mocks.getCvVersion,
  CvDocumentPreview: ({ document, rendererKey }) => <article className="cv-document-preview__page" data-testid="saved-version-document">{rendererKey}:{document.content_json.personal_info.full_name}</article>,
  createCvPdfExport: mocks.createCvPdfExport,
  downloadCvPdf: mocks.downloadCvPdf,
  getCvPdfExport: mocks.getCvPdfExport,
  retryCvPdfExport: mocks.retryCvPdfExport,
}))
vi.mock('html-to-image', () => ({ toBlob: mocks.toBlob }))
vi.mock('@/entities/candidate-preferences', () => ({
  getRecruiterVisibility: mocks.getRecruiterVisibility,
  updateRecruiterVisibility: mocks.updateRecruiterVisibility,
}))
vi.mock('@/entities/job', () => ({
  getCvJobRecommendations: mocks.getCvJobRecommendations,
  formatLocations: (job) => job.location,
  formatSalary: (job) => job.salary,
  jobDetailPath: (job) => `/viec-lam/${job.slug}`,
}))

const savedVersion = {
  public_id: 'cvv_2', schema_version: 1, template_renderer_key: 'classic_two_column_v1', assets: {},
  content_json: { personal_info: { full_name: 'Nguyễn An' }, sections: [] },
  layout_json: { page: { size: 'A4', margin_mm: 10 }, regions: [] },
  style_json: { theme_color: '#00A66A', font_family: 'Roboto', font_scale: 1, line_height: 1.4 },
}

const PREVIEW_CAPTURE_TIMEOUT = 15_000

function renderPage(initialEntry = '/save-cv-success/cv_1?type=create') {
  return render(<App><MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="/save-cv-success/:publicId" element={<CvSaveSuccess />} /></Routes></MemoryRouter></App>)
}

describe('CV save success page', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getCv.mockResolvedValue({
      title: 'Marketing', thumbnail_url: '/api/v2/cvs/cv_1/thumbnail/', thumbnail_status: 'ready', latest_version_public_id: 'cvv_2',
    })
    mocks.getCvVersion.mockResolvedValue(savedVersion)
    mocks.toBlob.mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:captured-cv')
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {})
    mocks.getCvJobRecommendations.mockResolvedValue({
      focus_keyword: 'Marketing', related_positions: [{ label: 'Digital Marketing', search: 'Digital Marketing' }],
      results: [{ public_id: 'job_1', slug: 'marketing-executive', title: 'Marketing Executive', company_name: 'Pro Company', location: 'Hà Nội', salary: '15 - 20 triệu', match_score: 82, match_reasons: ['Khớp vị trí'], match_details: [{ code: 'position', label: 'Khớp vị trí trên CV', points: 24 }], is_high_match: true }],
    })
    mocks.getRecruiterVisibility.mockResolvedValue({ enabled: false, policy_version: 'v1' })
    mocks.updateRecruiterVisibility.mockImplementation(async (payload) => ({ enabled: payload.enabled, policy_version: 'v1' }))
  })

  it('renders the exact immutable saved version, edit flow and CV-ranked jobs', async () => {
    renderPage()
    expect(await screen.findByText('Lưu CV thành công!')).toBeInTheDocument()
    expect(screen.getByText('CV của Marketing')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Ảnh xem trước Marketing' }, { timeout: PREVIEW_CAPTURE_TIMEOUT })).toHaveAttribute('src', 'blob:captured-cv')
    expect(screen.getByTestId('saved-version-document')).toHaveTextContent('classic_two_column_v1:Nguyễn An')
    expect(mocks.getCvVersion).toHaveBeenCalledWith('cv_1', 'cvv_2')
    expect(screen.getByText('Marketing Executive')).toBeInTheDocument()
    expect(screen.getByText('Rất phù hợp')).toBeInTheDocument()
    expect(screen.getByText('Khớp vị trí trên CV +24')).toBeInTheDocument()
    expect(screen.getByText('Ứng tuyển')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Chỉnh sửa/ })).toHaveAttribute('href', '/cvs/cv_1/edit?mode=edit')
  })

  it('shows the save response immediately without waiting for another preview request', async () => {
    renderPage({
      pathname: '/save-cv-success/cv_1', search: '?type=edit',
      state: { savedCv: { title: 'Marketing', latest_version_public_id: 'cvv_2' }, savedVersion },
    })

    expect(await screen.findByRole('img', { name: 'Ảnh xem trước Marketing' }, { timeout: PREVIEW_CAPTURE_TIMEOUT })).toHaveAttribute('src', 'blob:captured-cv')
    expect(screen.getByTestId('saved-version-document')).toHaveTextContent('classic_two_column_v1:Nguyễn An')
    expect(mocks.getCvVersion).not.toHaveBeenCalled()
  })

  it('requires explicit confirmation and uses the purpose-specific visibility endpoint', async () => {
    const user = userEvent.setup()
    renderPage()
    const visibility = await screen.findByRole('switch', { name: 'Cho phép nhà tuyển dụng tìm kiếm hồ sơ' })
    await user.click(visibility)
    expect(await screen.findByRole('dialog', { name: 'Cho phép nhà tuyển dụng tìm kiếm hồ sơ?' })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Tôi đã đọc và đồng ý/ }))
    await user.click(screen.getByRole('button', { name: 'Xác nhận cho phép' }))
    await waitFor(() => expect(mocks.updateRecruiterVisibility).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true, confirmed: true, cv_public_id: 'cv_1', source: 'cv_save_success',
    })))
  })

  it('allows retrying when the immutable version request fails', async () => {
    const user = userEvent.setup()
    mocks.getCv.mockResolvedValue({
      title: 'Marketing', thumbnail_url: null, thumbnail_status: 'pending', latest_version_public_id: 'cvv_2',
    })
    mocks.getCvVersion.mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce({
      public_id: 'cvv_2', schema_version: 1, template_renderer_key: 'classic_single_column_v1', assets: {},
      content_json: { personal_info: { full_name: 'Nguyễn An' }, sections: [] }, layout_json: { regions: [] }, style_json: {},
    })

    renderPage()

    expect(await screen.findByText('Chưa thể tạo ảnh xem trước')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Tải lại bản xem trước/ }))
    await waitFor(() => expect(mocks.getCvVersion).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('saved-version-document')).toHaveTextContent('Nguyễn An')
  })

  it('cancels pending preview frames when the page unmounts', async () => {
    const requestAnimationFrame = vi.spyOn(globalThis, 'requestAnimationFrame')
    const cancelAnimationFrame = vi.spyOn(globalThis, 'cancelAnimationFrame')
    const { unmount } = renderPage()

    await screen.findByText('Lưu CV thành công!')
    await waitFor(() => expect(requestAnimationFrame).toHaveBeenCalled())
    unmount()

    expect(cancelAnimationFrame).toHaveBeenCalled()
  })
})
