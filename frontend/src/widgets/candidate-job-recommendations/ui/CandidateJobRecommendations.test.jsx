import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CandidateJobRecommendations from './CandidateJobRecommendations'

const mocks = vi.hoisted(() => ({
  getRecommendations: vi.fn(),
}))

vi.mock('@/entities/job', () => ({
  formatLocations: () => 'Hà Nội',
  formatSalary: () => '20 - 30 triệu',
  getCandidateJobRecommendations: mocks.getRecommendations,
  jobCardToneClass: () => 'border-slate-200 bg-white',
  jobDetailPath: (job) => `/viec-lam/${job.slug}`,
  jobKeys: {
    candidateRecommendationsRoot: ['jobs', 'candidate-recommendations'],
    candidateRecommendations: (params) => ['jobs', 'candidate-recommendations', params],
    inlineRecommendationsRoot: ['jobs', 'inline-recommendations'],
  },
  JobPresentationLabels: () => null,
  VerifiedEmployerBadge: () => null,
}))

vi.mock('@/entities/session', () => ({
  useSession: () => ({
    isAuthenticated: true,
    user: { role: 'candidate', job_preferences_configured: true },
  }),
}))

vi.mock('@/features/hide-job-recommendation', () => ({
  useHideJobRecommendation: () => ({
    hiddenIds: new Set(),
    pendingIds: new Set(),
    hide: vi.fn(),
  }),
}))

vi.mock('@/features/saved-jobs', () => ({
  useSavedJob: () => [false, vi.fn(), false],
}))

vi.mock('@/features/track-job-engagement', () => ({
  JobImpressionBoundary: ({ children, className }) => <div className={className}>{children}</div>,
}))

vi.mock('@/shared/hooks/use-media-query', () => ({ useMediaQuery: () => false }))

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CandidateJobRecommendations variant="home" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CandidateJobRecommendations home surface', () => {
  beforeEach(() => {
    mocks.getRecommendations.mockReset()
  })

  it('renders two slides of four from at most eight jobs and links to the full feed', async () => {
    mocks.getRecommendations.mockResolvedValue({
      status: 'ready',
      results: Array.from({ length: 10 }, (_, index) => ({
        public_id: `job_${index + 1}`,
        slug: `job-${index + 1}`,
        title: `Job ${index + 1}`,
        company_name: 'ProCV',
        match_reasons: index === 0 ? ['Phù hợp với tìm kiếm của bạn'] : [],
      })),
    })

    const { container } = renderHome()

    expect(await screen.findByText('Job 1')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Gợi ý việc làm phù hợp' })).toBeVisible()
    expect(screen.getByText('Job 8')).toBeInTheDocument()
    expect(screen.queryByText('Job 9')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem trang 1' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Xem trang 2' })).toBeVisible()
    const firstSlideGrid = container.querySelector('.min-w-full > .grid')
    expect(firstSlideGrid).toHaveClass('sm:grid-cols-2')
    expect(firstSlideGrid).not.toHaveClass('lg:grid-cols-4')
    expect(screen.getByRole('link', { name: 'Job 1' })).toHaveClass('!text-black')
    expect(screen.getByRole('link', { name: /Xem tất cả/ })).toHaveAttribute(
      'href',
      '/tai-khoan/viec-lam-phu-hop',
    )
    expect(screen.getAllByRole('button', { name: 'Ẩn tin tuyển dụng này' })).toHaveLength(8)
  })
})
