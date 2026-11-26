import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobModeration from './JobModeration'

const { getAdminJobs, getAdminJobSummary } = vi.hoisted(() => ({
  getAdminJobs: vi.fn(),
  getAdminJobSummary: vi.fn(),
}))

vi.mock('@/entities/job/admin-job', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminJobs,
  getAdminJobSummary,
}))

vi.mock('@/features/admin/job/review-job-reports', () => ({
  JobReportQueue: () => <div>Mock report queue</div>,
}))

function renderPage(initialEntry = '/admin/app/duyet-tin') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <JobModeration />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('JobModeration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAdminJobs.mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'job_active',
        title: 'Backend Engineer',
        company_name: 'Acme',
        employer_verification_completed: true,
        employer_name: 'Nguyễn An',
        employer_email: 'an@example.com',
        status: 'active',
        status_label: 'Đang tuyển',
        deadline: '2026-08-30',
        created_at: '2026-07-22T08:00:00Z',
        submitted_at: '2026-07-22T09:00:00Z',
        application_count: 0,
        pending_report_count: 0,
        published_job_count: 2,
      }],
    })
    getAdminJobSummary.mockResolvedValue({
      total: 1,
      draft: 0,
      active: 1,
      expired: 0,
      closed: 0,
      held: 0,
      pending_reports: 0,
    })
  })

  it('loads every job by default and never offers an approval action', async () => {
    renderPage()

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()
    expect(getAdminJobs).toHaveBeenCalledWith(
      { ordering: '-created_at', page: 1 },
      expect.any(Object),
    )
    const row = screen.getByTestId('admin-job-row-job_active')
    expect(within(row).getByText('Đang tuyển')).toBeInTheDocument()
    expect(within(row).getByText('Acme')).toBeInTheDocument()
    expect(within(row).getByText('2 tin đã đăng')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Duyệt tin' })).not.toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Xem chi tiết' })).toBeVisible()
    expect(screen.getByText('Hiển thị 1–1 trên 1 tin')).toBeInTheDocument()
  })

  it('sends table ordering to the server and resets to page one', async () => {
    renderPage('/admin/app/duyet-tin?job_page=3')
    await screen.findByText('Backend Engineer')

    fireEvent.click(screen.getByRole('button', { name: 'Tin tuyển dụng' }))

    await waitFor(() => expect(getAdminJobs).toHaveBeenLastCalledWith(
      { ordering: '-title', page: 1 },
      expect.any(Object),
    ))
  })

  it('filters by a status tile and keeps the tile pressed', async () => {
    renderPage()
    await screen.findByText('Backend Engineer')
    const tiles = screen.getByRole('group', { name: 'Tổng quan tin tuyển dụng' })

    fireEvent.click(within(tiles).getByRole('button', { name: /Đang tuyển\s*1/ }))

    await waitFor(() => expect(getAdminJobs).toHaveBeenLastCalledWith(
      { scope: 'active', ordering: '-created_at', page: 1 },
      expect.any(Object),
    ))
    expect(within(tiles).getByRole('button', { name: /Đang tuyển/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('narrows the list to jobs with pending reports from the deep-linked scope', async () => {
    renderPage('/admin/app/duyet-tin?job_scope=reported')
    await screen.findByText('Backend Engineer')

    expect(getAdminJobs).toHaveBeenCalledWith(
      { has_reports: 'true', ordering: '-created_at', page: 1 },
      expect.any(Object),
    )
  })

  it('opens the report queue from the existing deep-linked tab', () => {
    renderPage('/admin/app/duyet-tin?tab=reports')

    expect(screen.getByRole('tab', { name: 'Báo cáo vi phạm' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('Mock report queue')).toBeVisible()
  })
})
