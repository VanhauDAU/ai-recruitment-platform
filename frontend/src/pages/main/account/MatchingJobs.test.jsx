import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchingJobs from './MatchingJobs'

const mocks = vi.hoisted(() => ({
  getCandidateJobRecommendations: vi.fn(),
  toggleSaved: vi.fn(),
  updateAiRecommendation: vi.fn(),
}))

vi.mock('@/entities/job/candidate-preferences', () => ({
  AI_RECOMMENDATION_QUERY_KEY: ['candidate', 'ai-recommendation'],
  getAiRecommendation: vi.fn().mockResolvedValue({ enabled: false }),
  updateAiRecommendation: mocks.updateAiRecommendation,
}))

vi.mock('@/entities/job/job', () => ({
  formatJobPostedLabel: () => 'Đăng 2 tuần trước',
  formatSalary: (job) => job.salary,
  jobCardToneClass: () => 'border-slate-200 bg-white',
  getCandidateJobRecommendations: mocks.getCandidateJobRecommendations,
  jobDetailPath: (job) => `/viec-lam/${job.slug}`,
  jobKeys: {
    candidateRecommendationsRoot: ['jobs', 'candidate-recommendations'],
    candidateRecommendations: (params) => ['jobs', 'candidate-recommendations', params],
    inlineRecommendationsRoot: ['jobs', 'inline-recommendations'],
  },
  JobPresentationLabels: () => null,
  VerifiedEmployerBadge: ({ verified }) => verified ? <span>Nhà tuyển dụng đã xác thực</span> : null,
}))

vi.mock('@/entities/account/session', () => ({
  useSession: () => ({ isAuthenticated: true, user: { role: 'candidate', job_preferences_configured: true } }),
}))

vi.mock('@/features/main/job/hide-job-recommendation', () => ({
  useHideJobRecommendation: () => ({
    hiddenIds: new Set(),
    pendingIds: new Set(),
    hide: vi.fn(),
  }),
}))

vi.mock('@/features/main/job/saved-jobs', () => ({
  useSavedJob: () => [false, mocks.toggleSaved, false],
}))

vi.mock('@/features/main/job/track-job-engagement', () => ({
  JobImpressionBoundary: ({ children }) => children,
}))

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <App>
        <MemoryRouter>
          <MatchingJobs />
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  )
}

describe('MatchingJobs', () => {
  beforeEach(() => {
    mocks.getCandidateJobRecommendations.mockReset()
    mocks.toggleSaved.mockReset()
  })

  it('shows preference reasons without exposing CV sources or match scores', async () => {
    mocks.getCandidateJobRecommendations.mockResolvedValue({
      status: 'ready',
      sources: { job_preferences: true, cv: true, search_activity: false },
      source_cv: { title: 'CV Fullstack', is_default: true },
      pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      results: [{
        public_id: 'job_1',
        slug: 'fullstack-developer',
        title: 'Fullstack Developer',
        company_name: 'Pro Company',
        company_verified: true,
        company_logo_url: '',
        salary: '20 - 30 triệu',
        locations_detail: [{ name: 'Hà Nội' }, { name: 'Đà Nẵng' }, { name: 'Huế' }],
        match_details: [{ code: 'category', label: 'Đúng vị trí chuyên môn', points: 38 }],
        match_reasons: ['Phù hợp với tìm kiếm của bạn'],
      }],
    })

    renderPage()

    expect(await screen.findByText('Fullstack Developer')).toBeInTheDocument()
    expect(screen.getByText('Hà Nội & 2 nơi khác')).toBeInTheDocument()
    expect(screen.getByText('Đăng 2 tuần trước')).toBeInTheDocument()
    expect(screen.getByText(/Tìm thấy/)).toHaveTextContent('Tìm thấy 1 việc làm phù hợp với yêu cầu của bạn.')
    // Lý do nằm trong chú thích "Vì sao phù hợp?".
    fireEvent.click(screen.getByRole('button', { name: /Vì sao phù hợp\?/ }))
    expect(await screen.findByText('Phù hợp với tìm kiếm của bạn')).toBeInTheDocument()
    expect(screen.queryByText('Gợi ý việc làm đang tắt')).not.toBeInTheDocument()
    expect(screen.getByText('Những công việc gần nhất với CV và hướng đi bạn mong muốn.')).toBeInTheDocument()
    expect(screen.queryByText('CV: CV Fullstack')).not.toBeInTheDocument()
    expect(screen.queryByText(/% phù hợp|Rất phù hợp/)).not.toBeInTheDocument()
    expect(screen.queryByText('Dữ liệu đang được dùng')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ẩn tin tuyển dụng này' })).toBeInTheDocument()
    expect(screen.getByRole('link', {
      name: 'Xem chi tiết Fullstack Developer qua logo công ty',
    })).toHaveAttribute('href', '/viec-lam/fullstack-developer')
    expect(screen.getByRole('link', { name: 'Ứng tuyển' })).toHaveAttribute(
      'href',
      '/viec-lam/fullstack-developer?ung-tuyen=1',
    )
  })

  it('keeps showing jobs when AI recommendations are off and offers to turn them back on', async () => {
    mocks.updateAiRecommendation.mockResolvedValue({ enabled: true })
    mocks.getCandidateJobRecommendations.mockResolvedValue({
      status: 'ready',
      strategy: 'latest-v1',
      ai_recommendation_enabled: false,
      pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      results: [{
        public_id: 'job_2', slug: 'ke-toan', title: 'Kế toán tổng hợp', company_name: 'Pro Company',
        salary: 'Thỏa thuận', match_details: [], match_reasons: [],
      }],
    })

    renderPage()

    expect(await screen.findByText('Kế toán tổng hợp')).toBeInTheDocument()
    expect(screen.getByText('Gợi ý việc làm đang tắt')).toBeInTheDocument()
    expect(screen.getByText(/Tìm thấy/)).toHaveTextContent('Tìm thấy 1 việc làm mới nhất.')
    expect(screen.queryByRole('button', { name: /Vì sao phù hợp/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Bật gợi ý việc làm/ }))
    expect(await screen.findByText('Xác nhận bật Gợi ý việc làm')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await vi.waitFor(() => expect(mocks.updateAiRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, source: 'account_settings' }),
    ))
  })

  it('does not read recommendation data until consent is granted', async () => {
    mocks.getCandidateJobRecommendations.mockResolvedValue({
      status: 'consent_required',
      results: [],
      pagination: { total: 0, total_pages: 0 },
    })

    renderPage()

    expect(await screen.findByText('Bật quyền gợi ý việc làm')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Đi tới cài đặt gợi ý/ })).toHaveAttribute(
      'href',
      '/tai-khoan/cai-dat-goi-y-viec-lam',
    )
  })

  it('asks for a CV or preferences when recommendations follow the CV', async () => {
    mocks.getCandidateJobRecommendations.mockResolvedValue({
      status: 'preferences_required',
      cv_recommendations_enabled: true,
      results: [],
      pagination: { total: 0, total_pages: 0 },
    })

    renderPage()

    expect(await screen.findByText('Lưu CV hoặc khai nhu cầu công việc')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Quản lý CV' })).toHaveAttribute('href', '/tai-khoan/cv-cua-toi')
  })

  it('suggests adding preferences when the list comes from the CV alone', async () => {
    mocks.getCandidateJobRecommendations.mockResolvedValue({
      status: 'ready',
      preference_configured: false,
      cv_recommendations_enabled: true,
      results: [],
      pagination: { total: 0, total_pages: 0 },
    })

    renderPage()

    expect(await screen.findByRole('link', { name: /Thêm nhu cầu để gợi ý sát hơn/ })).toBeInTheDocument()
  })
})
