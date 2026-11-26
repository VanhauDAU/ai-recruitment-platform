import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import JobCompanyTab from './JobCompanyTab'

const getJobs = vi.hoisted(() => vi.fn())
vi.mock('@/entities/job/job', async (importOriginal) => ({ ...(await importOriginal()), getJobs }))

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
      <MemoryRouter><JobCompanyTab job={JOB} active={active} /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('JobCompanyTab', () => {
  it('shows the company intro and at most six other company jobs once opened', async () => {
    const others = Array.from({ length: 8 }, (_, index) => ({ public_id: `jb_${index}`, slug: `tin-${index}-jb_${index}`, title: `Tin ${index}`, salary_type: 'negotiable', experience_years: 2, locations_detail: [{ name: 'Hà Nội' }] }))
    getJobs.mockResolvedValue({ count: 9, results: [{ public_id: 'jb_current', title: 'Tin đang xem' }, ...others] })
    renderTab()

    expect(screen.getByText('Doanh nghiệp Fintech hàng đầu.')).toBeVisible()
    expect(screen.getByText('Fintech')).toBeVisible()
    expect(screen.getByRole('link', { name: /momo\.vn/ })).toHaveAttribute('href', 'https://www.momo.vn/')
    const first = await screen.findByRole('link', { name: /Tin 0/ })
    expect(first).toHaveTextContent('Hà Nội · 2 năm')
    // Tối đa 6 tin, bỏ tin đang xem; "Xem tất cả" vẫn đếm đủ.
    expect(screen.getAllByRole('link', { name: /^Tin \d/ })).toHaveLength(6)
    expect(screen.queryByText('Tin đang xem')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Xem tất cả \(8\)/ })).toHaveAttribute('href', '/cong-ty/momo?tab=viec-lam')
    expect(getJobs).toHaveBeenCalledWith({ company: 'co_1', page: 1, page_size: 10 })
  })

  it('does not load company jobs until the tab is opened', () => {
    getJobs.mockClear()
    renderTab(false)
    expect(getJobs).not.toHaveBeenCalled()
    expect(screen.queryByText('Việc làm cùng công ty')).not.toBeInTheDocument()
  })
})
