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
  getCandidateJobRecommendations: mocks.getCandidateJobRecommendations,
  jobDetailPath: (job) => `/viec-lam/${job.slug}`,
  jobKeys: {
    candidateRecommendations: (params) => ['jobs', 'candidate-recommendations', params],
  },
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

  it('explains the preference and CV sources behind ranked jobs', async () => {
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
        match_score: 86,
        is_high_match: true,
        match_details: [{ code: 'category', label: 'Đúng vị trí chuyên môn', points: 38 }],
      }],
    })

    renderPage()

    expect(await screen.findByText('Fullstack Developer')).toBeInTheDocument()
    expect(screen.getByText('CV: CV Fullstack')).toBeInTheDocument()
    expect(screen.getByText('Rất phù hợp')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vì sao phù hợp/ })).toBeInTheDocument()
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
