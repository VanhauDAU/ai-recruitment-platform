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
  updateApplicationStatus: vi.fn(),
  cvPreview: vi.fn(),
}))

vi.mock('@/entities/application', () => ({
  applicationKeys: {
    recruiterList: (params) => ['applications', 'recruiter-list', params],
    recruiterSnapshot: (publicId) => ['applications', 'snapshot', publicId],
    history: (publicId) => ['applications', 'history', publicId],
  },
  getRecruiterApplicationPage: mocks.getRecruiterApplicationPage,
  getRecruiterApplicationSnapshot: mocks.getRecruiterApplicationSnapshot,
  getApplicationHistory: mocks.getApplicationHistory,
  updateApplicationStatus: mocks.updateApplicationStatus,
  RECRUITER_APPLICATION_STATUSES: [
    ['submitted', 'Tiếp nhận'],
    ['viewed', 'Đã xem'],
    ['accepted', 'Đã nhận offer'],
    ['rejected', 'Từ chối'],
  ],
  RECRUITER_APPLICATION_STATUS_LABELS: {
    submitted: 'Tiếp nhận', viewed: 'Đã xem', accepted: 'Đã nhận offer', rejected: 'Từ chối',
  },
}))

vi.mock('@/entities/cv', () => ({
  CvDocumentPreview: (props) => {
    mocks.cvPreview(props)
    return <div data-testid="canonical-cv-preview">CV preview</div>
  },
}))

const APPLICATIONS = [
  {
    public_id: 'app_1',
    candidate_name: 'Nguyễn An',
    candidate_email: 'an@example.com',
    job_title: 'Kỹ sư Frontend',
    submitted_cv_title: 'CV Frontend 2026',
    submitted_cv_version: 'cvv_1',
    applied_at: '2026-07-22T08:00:00+07:00',
    status: 'submitted',
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
    submitted_cv_version: 'cvv_2',
    applied_at: '2026-07-25T08:00:00+07:00',
    status: 'considering',
    source: 'applied',
  },
]

function snapshotFor(publicId) {
  const application = APPLICATIONS.find((item) => item.public_id === publicId) || APPLICATIONS[0]
  return {
    application_public_id: publicId,
    status: publicId === 'app_1' ? 'viewed' : application.status,
    submitted_cv_title: application.submitted_cv_title,
    submitted_cv_source: 'builder',
    contact_name: 'Nguyễn An',
    contact_email: 'an@example.com',
    contact_phone: '0900000000',
    preferred_location_names: ['Đà Nẵng'],
    allow_ai_analysis: true,
    cv: {
      schema_version: 1,
      content_json: { profile: { full_name: 'Nguyễn An' } },
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
    mocks.getRecruiterApplicationPage.mockReset().mockResolvedValue({
      count: 2, next: null, previous: null, results: APPLICATIONS,
    })
    mocks.getRecruiterApplicationSnapshot.mockReset().mockImplementation(async (publicId) => snapshotFor(publicId))
    mocks.getApplicationHistory.mockReset().mockResolvedValue([
      {
        from_status: 'submitted', to_status: 'viewed', changed_by_name: 'HR Team',
        note: '', created_at: '2026-07-22T09:00:00+07:00',
      },
    ])
    mocks.updateApplicationStatus.mockReset().mockImplementation(async (publicId, payload) => ({
      ...APPLICATIONS.find((item) => item.public_id === publicId),
      ...payload,
      public_id: publicId,
    }))
    mocks.cvPreview.mockReset()
  })

  it('renders a three-column workspace and groups multiple CVs under one candidate', async () => {
    renderPage()

    const candidateList = await screen.findByTestId('application-candidate-list')
    const preview = screen.getByTestId('application-cv-preview')
    const inspector = screen.getByTestId('application-inspector')

    expect(within(candidateList).getByRole('heading', { name: 'Ứng viên' })).toBeVisible()
    expect(within(preview).getByRole('heading', { name: 'Xem trước CV' })).toBeVisible()
    expect(within(inspector).getByRole('heading', { name: 'Thông tin liên quan' })).toBeVisible()
    expect(await within(candidateList).findByRole('button', { name: 'Thu gọn hồ sơ của Nguyễn An' })).toBeVisible()
    expect(within(candidateList).getByText('2 CV')).toBeVisible()
    expect(within(candidateList).getByRole('button', { name: 'Xem CV Frontend 2026 của Nguyễn An' })).toBeVisible()
    expect(within(candidateList).getByRole('button', { name: 'Xem CV Frontend cập nhật của Nguyễn An' })).toBeVisible()

    expect(await screen.findByTestId('canonical-cv-preview')).toBeVisible()
    expect(within(inspector).getAllByText('Đã xem').length).toBeGreaterThan(0)
    expect(mocks.cvPreview).toHaveBeenCalledWith(expect.objectContaining({
      rendererKey: 'modern-green',
      editorChrome: false,
      document: expect.objectContaining({ schema_version: 1 }),
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

  it('saves the internal assessment with the authoritative snapshot status', async () => {
    const user = userEvent.setup()
    renderPage()

    const inspector = await screen.findByTestId('application-inspector')
    const note = await within(inspector).findByLabelText('Ghi chú nội bộ')
    await user.clear(note)
    await user.type(note, 'Mời phỏng vấn vòng kỹ thuật')
    await user.click(within(inspector).getByRole('button', { name: 'Lưu đánh giá' }))

    await waitFor(() => expect(mocks.updateApplicationStatus).toHaveBeenCalledWith('app_1', {
      status: 'viewed',
      employer_note: 'Mời phỏng vấn vòng kỹ thuật',
      employer_rating: 4,
    }))
  })
})
