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
}))

vi.mock('@/entities/application', async (importOriginal) => ({
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

vi.mock('@/shared/lib/download-blob', () => ({ triggerBlobDownload: mocks.triggerBlobDownload }))

vi.mock('@/entities/cv', () => ({
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
    expect(within(candidateList).getByRole('button', { name: 'Không phù hợp' })).toBeVisible()
    expect(await within(candidateList).findByRole('button', { name: 'Thu gọn hồ sơ của Nguyễn An' })).toBeVisible()
    expect(within(candidateList).getByText('2 CV')).toBeVisible()
    expect(within(preview).getByRole('heading', { name: 'Xem trước CV' })).toBeVisible()
    expect(within(preview).getByRole('button', { name: /Tải PDF/ })).toBeEnabled()
    expect(within(preview).getByRole('button', { name: /Nhắn tin/ })).toBeDisabled()
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

  it('filters by status through the URL', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Phỏng vấn', pressed: false }))

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
    mocks.decideApplicationStatus.mockResolvedValue({
      application: { ...APPLICATIONS[0], status: 'shortlisted', available_decisions: ['interviewed', 'accepted', 'rejected'] },
      candidate_notice_at: '2026-07-22T09:10:00+07:00',
    })
    mocks.undoApplicationStatusChange.mockResolvedValue(APPLICATIONS[0])
    renderPage()

    const inspector = await screen.findByTestId('application-inspector')
    const decisions = await within(inspector).findByRole('group', { name: 'Quyết định cho hồ sơ' })
    mocks.getApplicationHistory.mockResolvedValue([
      VIEWED_ROW,
      { ...VIEWED_ROW, from_status: 'viewed', to_status: 'shortlisted', can_undo: true, candidate_notice: { state: 'scheduled', deliver_at: '2026-07-22T09:10:00+07:00', delivered_at: null, email_sent_at: null } },
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
