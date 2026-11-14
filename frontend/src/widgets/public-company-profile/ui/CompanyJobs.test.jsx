import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CompanyJobsPreview } from './CompanyJobs'

vi.mock('../model/use-company-jobs', () => ({
  COMPANY_JOBS_PAGE_SIZE: 10,
  useCompanyJobs: () => ({
    jobs: [1, 2, 3].map((index) => ({ public_id: `jb_${index}`, slug: `tin-${index}`, title: `Tin tuyển dụng ${index}` })),
    count: 3,
    isPending: false,
    isError: false,
  }),
}))
vi.mock('@/entities/session', () => ({ useSession: () => ({ isAuthenticated: false, user: null }) }))
vi.mock('@/features/auth', () => ({ useLoginPrompt: () => ({ promptLogin: vi.fn() }) }))
vi.mock('@/features/saved-jobs', () => ({ useSavedJob: () => [false, vi.fn(), false] }))
vi.mock('@/features/track-job-engagement', () => ({
  JobImpressionBoundary: ({ as: Component = 'div', slug, ...props }) => <Component data-job-slug={slug} {...props} />,
}))

function renderPreview(jobsSection) {
  const company = { public_id: 'co_1', slug: 'acme', sections: [{ key: 'jobs', type: 'jobs', title: 'Việc làm đang tuyển', ...jobsSection }] }
  render(<MemoryRouter><CompanyJobsPreview company={company} jobsPath="/cong-ty/acme?tab=viec-lam" /></MemoryRouter>)
}

describe('company jobs pinned marker', () => {
  it('tags only the jobs the company pinned', () => {
    renderPreview({ pinned_job_public_ids: ['jb_2'] })

    expect(screen.getAllByText('Nổi bật')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: /Tin tuyển dụng 2/ })).toHaveTextContent('Nổi bật')
    expect(screen.getByRole('heading', { name: /Tin tuyển dụng 1/ })).not.toHaveTextContent('Nổi bật')
  })

  it('shows no marker when the read model has no pinned jobs', () => {
    renderPreview({})

    expect(screen.queryByText('Nổi bật')).not.toBeInTheDocument()
  })
})
