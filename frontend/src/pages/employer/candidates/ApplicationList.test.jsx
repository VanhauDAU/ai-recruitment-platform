import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerApplicationList from './ApplicationList'

const mocks = vi.hoisted(() => ({
  getRecruiterApplicationPage: vi.fn(),
  getRecruiterApplicationSnapshot: vi.fn(),
  getApplicationHistory: vi.fn(),
  updateApplicationAssessment: vi.fn(),
  decideApplicationStatus: vi.fn(),
  undoApplicationStatusChange: vi.fn(),
  requestApplicationCvExport: vi.fn(),
  getApplicationCvExport: vi.fn(),
  downloadApplicationCv: vi.fn(),
  getApplicationReviews: vi.fn(),
  triggerBlobDownload: vi.fn(),
  cvPreview: vi.fn(),
  getEmployerJobPage: vi.fn(),
}))

vi.mock('@/entities/application/application', async (importOriginal) => ({
  ...(await importOriginal()),
  getRecruiterApplicationPage: mocks.getRecruiterApplicationPage,
  getRecruiterApplicationSnapshot: mocks.getRecruiterApplicationSnapshot,
  getApplicationHistory: mocks.getApplicationHistory,
  updateApplicationAssessment: mocks.updateApplicationAssessment,
  decideApplicationStatus: mocks.decideApplicationStatus,
  undoApplicationStatusChange: mocks.undoApplicationStatusChange,
  requestApplicationCvExport: mocks.requestApplicationCvExport,
  getApplicationCvExport: mocks.getApplicationCvExport,
  downloadApplicationCv: mocks.downloadApplicationCv,
  getApplicationReviews: mocks.getApplicationReviews,
}))

vi.mock('@/entities/job/job', async (importOriginal) => ({
  ...(await importOriginal()),
  getEmployerJobPage: mocks.getEmployerJobPage,
}))

vi.mock('@/shared/lib/download-blob', () => ({ triggerBlobDownload: mocks.triggerBlobDownload }))

vi.mock('@/entities/cv/cv', () => ({
  CvDocumentPreview: (props) => {
    mocks.cvPreview(props)
    return <div data-testid="canonical-cv-preview">CV preview</div>
  },
}))

const DECISIONS = ['shortlisted', 'interviewed', 'accepted', 'rejected']
const APPLICATIONS = [
  {
    public_id: 'app_1',
    candidate_name: 'Nguyễn An',
    candidate_email: 'an@example.com',
    job_title: 'Kỹ sư Frontend',
    submitted_cv_title: 'CV Frontend 2026',
    applied_at: '2026-07-22T08:00:00+07:00',
    status: 'viewed',
    available_decisions: DECISIONS,
    employer_note: 'Có kinh nghiệm React',
    employer_rating: 4,
    source: 'applied',
  },
  {
    public_id: 'app_2',
    candidate_name: 'Nguyễn An',
    candidate_email: 'AN@example.com',
    job_title: 'Kỹ sư Frontend',
    submitted_cv_title: 'CV Frontend cập nhật',
    applied_at: '2026-07-25T08:00:00+07:00',
    status: 'submitted',
    available_decisions: DECISIONS,
    mass_apply_signal: { jobs: 6, window_days: 14 },
    source: 'applied',
  },
]
const VIEWED_ROW = {
  from_status: 'submitted',
  to_status: 'viewed',
  changed_by_name: 'HR Team',
  note: '',
  created_at: '2026-07-22T09:00:00+07:00',
  reverted_at: null,
  can_undo: false,
  candidate_notice: { state: 'delivered', deliver_at: '2026-07-22T09:00:00+07:00', delivered_at: '2026-07-22T09:01:00+07:00', email_sent_at: null },
}

function snapshotFor(publicId) {
  const application = APPLICATIONS.find((item) => item.public_id === publicId)
  return {
    application_public_id: publicId,
    status: 'viewed',
    submitted_cv_title: application.submitted_cv_title,
    submitted_cv_source: 'builder',
    contact_name: 'Nguyễn An',
    contact_email: 'an@example.com',
    contact_phone: '0900000000',
    preferred_location_names: ['Đà Nẵng'],
    allow_ai_analysis: true,
    cv: {
      schema_version: 1,
      content_json: { personal_info: { full_name: 'Nguyễn An' } },
      layout_json: {},
      style_json: {},
      template_renderer_key: 'modern-green',
      assets: [],
    },
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location-search">{location.search}</output>
}

function renderPage(initialEntry = '/tuyendung/app/applications?job=jb_1&q=an%40example.com&application=app_1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <EmployerApplicationList />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EmployerApplicationList', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getRecruiterApplicationPage.mockResolvedValue({
      count: 2, next: null, previous: null, results: APPLICATIONS,
    })
    mocks.getRecruiterApplicationSnapshot.mockImplementation(async (publicId) => snapshotFor(publicId))
    mocks.getApplicationHistory.mockResolvedValue([VIEWED_ROW])
    mocks.getEmployerJobPage.mockResolvedValue({
      count: 2, results: [{ public_id: 'jb_1', title: 'Kỹ sư Frontend' }, { public_id: 'jb_2', title: 'Kỹ sư Backend' }],
    })
    mocks.getApplicationReviews.mockResolvedValue({
      summary: { total: 1, average_rating: 4, by_recommendation: { strong_yes: 0, yes: 1, no: 0, strong_no: 0 } },
      results: [{ reviewer_name: 'Anh Minh', recommendation: 'yes', recommendation_label: 'Nên tuyển', rating: 4, strengths: 'SQL tốt', concerns: '', submitted_at: '2026-07-22T10:00:00+07:00', updated_at: '2026-07-22T10:00:00+07:00' }],
    })
  })

  it('renders the three-column workspace with decisions, PDF download and a disabled message action', async () => {
    renderPage()

    const candidateList = await screen.findByTestId('application-candidate-list')
    const preview = screen.getByTestId('application-cv-preview')
    const inspector = screen.getByTestId('application-inspector')

    expect(within(candidateList).getByRole('heading', { name: 'Ứng viên' })).toBeVisible()
    expect(within(candidateList).getByRole('combobox', { name: 'Lọc trạng thái hồ sơ' })).toBeVisible()
    expect(within(candidateList).getByRole('combobox', { name: 'Lọc theo tin tuyển dụng' })).toBeVisible()
    expect(within(candidateList).getByRole('combobox', { name: 'Sắp xếp hồ sơ' })).toBeVisible()
    // Hai CV của cùng một người: tên hiện một lần, các CV xếp ngay dưới.
    const cvs = await within(candidateList).findByRole('list', { name: 'Các CV của Nguyễn An' })
    expect(within(cvs).getAllByRole('button')).toHaveLength(2)
    expect(within(candidateList).getByText('2 CV')).toBeVisible()
    expect(within(preview).getByRole('heading', { name: 'CV Frontend 2026' })).toBeVisible()
    expect(within(preview).getByRole('button', { name: /Tải PDF/ })).toBeEnabled()
    expect(within(inspector).getByRole('heading', { name: 'Xử lý hồ sơ' })).toBeVisible()
    const decisions = await within(inspector).findByRole('group', { name: 'Quyết định cho hồ sơ' })
    expect(within(decisions).getAllByRole('button')).toHaveLength(4)
    expect(await screen.findByTestId('canonical-cv-preview')).toBeVisible()
    expect(await within(inspector).findByText(/Đã báo ứng viên/)).toBeVisible()
    expect(await within(inspector).findByText('Anh Minh')).toBeVisible()
    expect(within(preview).getByRole('button', { name: /Mời đánh giá/ })).toBeEnabled()
    expect(mocks.cvPreview).toHaveBeenCalledWith(expect.objectContaining({
      rendererKey: 'modern-green',
      editorChrome: false,
    }))
  })

  it('keeps list filters in the URL when another CV of the grouped candidate is selected', async () => {
    const user = userEvent.setup()
    renderPage()

    const candidateList = await screen.findByTestId('application-candidate-list')
    await user.click(await within(candidateList).findByRole('button', {
      name: 'Xem CV Frontend cập nhật của Nguyễn An',
    }))

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('location-search').textContent)
      expect(params.get('job')).toBe('jb_1')
      expect(params.get('q')).toBe('an@example.com')
      expect(params.get('application')).toBe('app_2')
    })
    await waitFor(() => expect(mocks.getRecruiterApplicationSnapshot).toHaveBeenCalledWith('app_2'))
  })

  it('flags mass applying with a block action', async () => {
    renderPage('/tuyendung/app/applications?job=jb_1&application=app_2')

    const inspector = await screen.findByTestId('application-inspector')
    expect(await within(inspector).findByText('Có dấu hiệu ứng tuyển hàng loạt')).toBeVisible()
    expect(within(inspector).getByText(/6 tin của bạn trong 14 ngày/)).toBeVisible()
    expect(within(inspector).getAllByRole('button', { name: /Chặn ứng viên/ }).length).toBeGreaterThan(0)
  })

  it('zooms the CV in and back to the panel width', async () => {
    const user = userEvent.setup()
    renderPage()

    const preview = await screen.findByTestId('application-cv-preview')
    const zoom = await within(preview).findByRole('group', { name: 'Thu phóng CV' })
    const level = within(zoom).getByRole('status')
    const fitted = level.textContent
    expect(within(zoom).getByRole('button', { name: 'Vừa khung' })).toBeDisabled()

    await user.click(within(zoom).getByRole('button', { name: 'Phóng to' }))
    expect(level.textContent).not.toBe(fitted)
    await user.click(within(zoom).getByRole('button', { name: 'Vừa khung' }))
    expect(level.textContent).toBe(fitted)
  })

  it('filters by job and sorts through the URL', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('combobox', { name: 'Lọc theo tin tuyển dụng' }))
    await user.click(await screen.findByTitle('Kỹ sư Backend'))
    await user.click(screen.getByRole('combobox', { name: 'Sắp xếp hồ sơ' }))
    await user.click(await screen.findByTitle('Cũ nhất'))

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('location-search').textContent)
      expect(params.get('job')).toBe('jb_2')
      expect(params.get('ordering')).toBe('oldest')
      expect(params.get('application')).toBeNull()
    })
  })

  it('filters by status through the URL', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('combobox', { name: 'Lọc trạng thái hồ sơ' }))
    await user.click(await screen.findByTitle('Phỏng vấn'))

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('location-search').textContent)
      expect(params.get('status')).toBe('interviewed')
    })
  })

  it('saves only the private note and rating', async () => {
    const user = userEvent.setup()
    mocks.updateApplicationAssessment.mockImplementation(async (publicId, payload) => ({
      ...APPLICATIONS[0], ...payload,
    }))
    renderPage()

    const inspector = await screen.findByTestId('application-inspector')
    const note = await within(inspector).findByLabelText('Ghi chú nội bộ')
    await user.clear(note)
    await user.type(note, 'Mời phỏng vấn vòng kỹ thuật')
    await user.click(within(inspector).getByRole('button', { name: 'Lưu đánh giá' }))

    await waitFor(() => expect(mocks.updateApplicationAssessment).toHaveBeenCalledWith('app_1', {
      employer_note: 'Mời phỏng vấn vòng kỹ thuật',
      employer_rating: 4,
    }))
  })

  it('decides immediately for non-final statuses and offers undo while the notice is pending', async () => {
    const user = userEvent.setup()
    const noticeAt = new Date(Date.now() + 15_000).toISOString()
    mocks.decideApplicationStatus.mockResolvedValue({
      application: { ...APPLICATIONS[0], status: 'shortlisted', available_decisions: ['interviewed', 'accepted', 'rejected'] },
      candidate_notice_at: noticeAt,
    })
    mocks.undoApplicationStatusChange.mockResolvedValue(APPLICATIONS[0])
    renderPage()

    const inspector = await screen.findByTestId('application-inspector')
    const decisions = await within(inspector).findByRole('group', { name: 'Quyết định cho hồ sơ' })
    mocks.getApplicationHistory.mockResolvedValue([
      VIEWED_ROW,
      { ...VIEWED_ROW, from_status: 'viewed', to_status: 'shortlisted', can_undo: true, candidate_notice: { state: 'scheduled', deliver_at: noticeAt, delivered_at: null, email_sent_at: null } },
    ])
    await user.click(within(decisions).getByRole('button', { name: 'Phù hợp' }))

    await waitFor(() => expect(mocks.decideApplicationStatus).toHaveBeenCalledWith('app_1', 'shortlisted'))
    await user.click(await within(inspector).findByRole('button', { name: 'Hoàn tác' }))
    await waitFor(() => expect(mocks.undoApplicationStatusChange).toHaveBeenCalledWith('app_1'))
  })

  it('asks for confirmation before a final decision', async () => {
    const user = userEvent.setup()
    mocks.decideApplicationStatus.mockResolvedValue({
      application: { ...APPLICATIONS[0], status: 'rejected', available_decisions: [] },
      candidate_notice_at: '2026-07-22T09:10:00+07:00',
    })
    renderPage()

    const inspector = await screen.findByTestId('application-inspector')
    const decisions = await within(inspector).findByRole('group', { name: 'Quyết định cho hồ sơ' })
    await user.click(within(decisions).getByRole('button', { name: 'Không phù hợp' }))
    expect(mocks.decideApplicationStatus).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Không phù hợp' }))
    await waitFor(() => expect(mocks.decideApplicationStatus).toHaveBeenCalledWith('app_1', 'rejected'))
  })

  it('renders the submitted CV as PDF and saves it', async () => {
    const user = userEvent.setup()
    const blob = new Blob(['%PDF'])
    mocks.requestApplicationCvExport.mockResolvedValue({ public_id: 'cve_1', status: 'completed', download_url: 'http://api/cv.pdf' })
    mocks.downloadApplicationCv.mockResolvedValue(blob)
    renderPage()

    const preview = await screen.findByTestId('application-cv-preview')
    await user.click(within(preview).getByRole('button', { name: /Tải PDF/ }))

    await waitFor(() => expect(mocks.triggerBlobDownload).toHaveBeenCalledWith(blob, 'CV - Nguyễn An.pdf'))
    expect(mocks.requestApplicationCvExport).toHaveBeenCalledWith('app_1')
  })
})
