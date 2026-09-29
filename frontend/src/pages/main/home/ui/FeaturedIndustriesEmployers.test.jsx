import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublicCompanies } from '@/entities/company'
import { getJobStats } from '@/entities/job'
import FeaturedIndustriesEmployers from './FeaturedIndustriesEmployers'

vi.mock('@/entities/company', async (importOriginal) => ({
  ...(await importOriginal()),
  getPublicCompanies: vi.fn(),
}))

vi.mock('@/entities/job', async (importOriginal) => ({
  ...(await importOriginal()),
  getJobStats: vi.fn(),
}))

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FeaturedIndustriesEmployers />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FeaturedIndustriesEmployers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getJobStats.mockResolvedValue({
      active_jobs: 20,
      candidates: 30,
      demand: [],
      employers: 10,
      featured_employers: [{
        public_id: 'legacy-company',
        company_name: 'Công ty từ job stats',
        company_logo_url: '/legacy.png',
        job_count: 99,
      }],
    })
    getPublicCompanies.mockResolvedValue({
      next: null,
      previous: null,
      results: [{
        public_id: 'public-company',
        company_name: 'Công ty từ danh bạ công khai',
        logo_url: '/public-company.png',
        active_public_job_count: 7,
        industries_detail: [{ id: 1, name: 'Công nghệ', slug: 'cong-nghe' }],
      }],
    })
  })

  it('uses the same unfiltered featured-company endpoint as the public directory', async () => {
    renderSection()

    const panel = await screen.findByRole('region', { name: 'Công ty nổi bật' })
    expect(within(panel).getByText('Công ty từ danh bạ công khai')).toBeVisible()
    expect(within(panel).getByText('7 Việc làm')).toBeVisible()
    expect(within(panel).getByText('Công nghệ')).toBeVisible()
    expect(screen.queryByText('Công ty từ job stats')).not.toBeInTheDocument()
    expect(getPublicCompanies).toHaveBeenCalledWith(
      {},
      { signal: expect.any(AbortSignal) },
    )
  })
})
