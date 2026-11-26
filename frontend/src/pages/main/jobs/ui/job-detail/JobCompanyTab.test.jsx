import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import JobCompanyTab from './JobCompanyTab'

const getJobs = vi.hoisted(() => vi.fn())
vi.mock('@/entities/job/job', async (importOriginal) => ({ ...(await importOriginal()), getJobs }))
vi.mock('../JobCard', () => ({ default: ({ job }) => <article>{job.title}</article> }))

const JOB = {
  public_id: 'jb_current',
  company_public_id: 'co_1',
  company_slug: 'momo',
  company_name: 'Công ty CP MoMo',
  company_description: 'Doanh nghiệp Fintech hàng đầu.',
  company_industries: ['Fintech'],
  company_website_url: 'https://www.momo.vn/',
}

function renderTab(active = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><JobCompanyTab job={JOB} active={active} isAuthenticated={false} onRequireLogin={vi.fn()} /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('JobCompanyTab', () => {
  it('shows the company intro and a rail of its other jobs once opened', async () => {
    getJobs.mockResolvedValue({ count: 3, results: [{ public_id: 'jb_current', title: 'Tin đang xem' }, { public_id: 'jb_2', title: 'QA Engineer' }, { public_id: 'jb_3', title: 'Fraud Analyst' }] })
    renderTab()

    expect(screen.getByText('Doanh nghiệp Fintech hàng đầu.')).toBeVisible()
    expect(screen.getByText('Fintech')).toBeVisible()
    expect(screen.getByRole('link', { name: /momo\.vn/ })).toHaveAttribute('href', 'https://www.momo.vn/')
    expect(await screen.findByText('QA Engineer')).toBeVisible()
    expect(screen.getByText('Fraud Analyst')).toBeVisible()
    expect(screen.queryByText('Tin đang xem')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Xem tất cả \(2\)/ })).toHaveAttribute('href', '/cong-ty/momo?tab=viec-lam')
    expect(getJobs).toHaveBeenCalledWith({ company: 'co_1', page: 1, page_size: 10 })
  })

  it('does not load company jobs until the tab is opened', () => {
    getJobs.mockClear()
    renderTab(false)
    expect(getJobs).not.toHaveBeenCalled()
    expect(screen.queryByText('Việc làm cùng công ty')).not.toBeInTheDocument()
  })
})
