import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobModeration from './JobModeration'

const { getAdminJobs, getAdminJobSummary } = vi.hoisted(() => ({
  getAdminJobs: vi.fn(),
  getAdminJobSummary: vi.fn(),
}))

vi.mock('@/entities/admin-job', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminJobs,
  getAdminJobSummary,
}))

vi.mock('@/features/review-job-reports', () => ({
  JobReportQueue: () => <div>Mock report queue</div>,
}))

vi.mock('antd', async (importOriginal) => {
  const antd = await importOriginal()
  return {
    ...antd,
    Table: ({ columns, dataSource = [], onChange }) => (
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key || column.dataIndex}>
                {column.sorter ? (
                  <button
                    aria-label={`Sắp xếp ${column.key}`}
                    onClick={() => onChange(
                      { current: 1 },
                      {},
                      { columnKey: column.key, order: 'descend' },
                    )}
                    type="button"
                  >
                    {column.title}
                  </button>
                ) : column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource.map((row, rowIndex) => (
            <tr key={row.public_id}>
              {columns.map((column) => {
                const value = column.dataIndex ? row[column.dataIndex] : undefined
                return (
                  <td key={column.key || column.dataIndex}>
                    {column.render ? column.render(value, row, rowIndex) : value}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    ),
  }
})

function renderPage(initialEntry = '/admin/app/job-moderation') {
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
        public_id: 'job_pending',
        title: 'Backend Engineer',
        company_name: 'Acme',
        employer_verification_completed: true,
        employer_name: 'Nguyễn An',
        employer_email: 'an@example.com',
        status: 'pending',
        status_label: 'Chờ duyệt',
        deadline: '2026-08-30',
        created_at: '2026-07-22T08:00:00Z',
        submitted_at: '2026-07-22T09:00:00Z',
        application_count: 0,
        pending_report_count: 0,
        approved_job_count: 2,
      }],
    })
    getAdminJobSummary.mockResolvedValue({
      total: 1,
      pending: 1,
      active: 0,
      held: 0,
      rejected: 0,
      overdue: 0,
      pending_reports: 0,
      sla_hours: 24,
    })
  })

  it('loads the pending queue without exposing direct approval actions in the table', async () => {
    renderPage()

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()
    expect(getAdminJobs).toHaveBeenCalledWith(
      { ordering: '-created_at', page: 1, status: 'pending' },
      expect.any(Object),
    )
    expect(screen.getByRole('button', { name: 'Sắp xếp created_at' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Duyệt tin' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem chi tiết' })).toBeVisible()
  })

  it('sends table ordering to the server and resets to page one', async () => {
    renderPage('/admin/app/job-moderation?job_page=3')
    await screen.findByText('Backend Engineer')

    fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp title' }))

    await waitFor(() => expect(getAdminJobs).toHaveBeenLastCalledWith(
      { ordering: '-title', page: 1, status: 'pending' },
      expect.any(Object),
    ))
  })

  it('opens the report queue from the existing deep-linked tab', () => {
    renderPage('/admin/app/job-moderation?tab=reports')

    expect(screen.getByRole('tab', { name: 'Báo cáo vi phạm' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('Mock report queue')).toBeVisible()
  })
})
