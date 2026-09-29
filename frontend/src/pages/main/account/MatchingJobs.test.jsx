import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchingJobs from './MatchingJobs'

const mocks = vi.hoisted(() => ({
  getCandidateJobRecommendations: vi.fn(),
  toggleSaved: vi.fn(),
}))

vi.mock('@/entities/job', () => ({
  formatLocations: (job) => job.location,
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

vi.mock('@/entities/session', () => ({
  useSession: () => ({ isAuthenticated: true, user: { role: 'candidate', job_preferences_configured: true } }),
}))

vi.mock('@/features/hide-job-recommendation', () => ({
  useHideJobRecommendation: () => ({
    hiddenIds: new Set(),
    pendingIds: new Set(),
    hide: vi.fn(),
  }),
}))

vi.mock('@/features/saved-jobs', () => ({
  useSavedJob: () => [false, mocks.toggleSaved, false],
}))

vi.mock('@/features/track-job-engagement', () => ({
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
        location: 'Hà Nội',
        match_details: [{ code: 'category', label: 'Đúng vị trí chuyên môn', points: 38 }],
        match_reasons: ['Phù hợp với tìm kiếm của bạn'],
      }],
    })

    renderPage()

    expect(await screen.findByText('Fullstack Developer')).toBeInTheDocument()
    expect(screen.getByText('Phù hợp với tìm kiếm của bạn')).toBeInTheDocument()
    expect(screen.getByText('Những công việc phù hợp nhất với bạn dựa trên mong muốn, kỹ năng và kinh nghiệm.')).toBeInTheDocument()
    expect(screen.queryByText('CV: CV Fullstack')).not.toBeInTheDocument()
    expect(screen.queryByText(/% phù hợp|Rất phù hợp/)).not.toBeInTheDocument()
    expect(screen.queryByText('Dữ liệu đang được dùng')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ẩn tin tuyển dụng này' })).toBeInTheDocument()
    expect(screen.getByRole('link', {
      name: 'Xem chi tiết Fullstack Developer qua logo công ty',
    })).toHaveAttribute('href', '/viec-lam/fullstack-developer')
    expect(screen.getByRole('link', { name: /Xem việc làm/ })).toHaveAttribute(
      'href',
      '/viec-lam/fullstack-developer',
    )
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
})
