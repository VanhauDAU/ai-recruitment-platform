import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobReportQueue from './JobReportQueue'

const mocks = vi.hoisted(() => ({
  canResolve: true,
  getAdminJobReports: vi.fn(),
  resolveAdminJobReport: vi.fn(),
  reverseAdminJobReport: vi.fn(),
}))

vi.mock('@/entities/admin-access', () => ({
  useAdminAccess: () => ({
    has: () => mocks.canResolve,
  }),
}))

vi.mock('@/entities/session', () => ({
  useSession: () => ({ user: { role: 'admin' } }),
}))

vi.mock('@/entities/job', () => ({
  jobDetailPath: ({ slug }) => `/viec-lam/${slug}`,
}))

vi.mock('@/entities/job-report', () => ({
  getAdminJobReports: mocks.getAdminJobReports,
  resolveAdminJobReport: mocks.resolveAdminJobReport,
  reverseAdminJobReport: mocks.reverseAdminJobReport,
  jobReportKeys: {
    adminLists: ['job-reports', 'admin-list'],
    adminList: (params) => ['job-reports', 'admin-list', params],
  },
  JOB_REPORT_STATUS_OPTIONS: [
    { value: 'pending', label: 'Chờ xử lý' },
    { value: 'upheld', label: 'Đã xác nhận vi phạm' },
    { value: 'dismissed', label: 'Đã bác bỏ' },
  ],
  JOB_REPORT_STATUS_LABELS: {
    pending: 'Chờ xử lý',
    upheld: 'Đã xác nhận vi phạm',
    dismissed: 'Đã bác bỏ',
  },
  JOB_REPORT_STATUS_COLORS: {
    pending: 'gold',
    upheld: 'red',
    dismissed: 'green',
  },
  JOB_REPORT_REASON_OPTIONS: [
    { value: 'fake_company', label: 'Công ty không có thật' },
    { value: 'scam', label: 'Lừa đảo, thu phí ứng viên' },
  ],
}))

vi.mock('@/shared/lib/toast', () => ({
  message: { error: vi.fn(), success: vi.fn() },
}))

const REPORT = {
  public_id: 'jrep_1',
  job_slug: 'backend-engineer',
  brand_slug: null,
  job_title: 'Backend Engineer',
  company_name: 'Acme',
  reporter_email: 'candidate@example.com',
  reason_label: 'Thông tin sai sự thật',
  detail: 'Mức lương không đúng.',
  status: 'pending',
  created_at: '2026-07-27T01:00:00Z',
  resolution_history: [],
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location-search">{location.search}</output>
}

function renderQueue(initialEntry = '/admin/app/job-moderation?tab=reports') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App>
          <JobReportQueue />
          <LocationProbe />
        </App>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('JobReportQueue', () => {
  beforeEach(() => {
    mocks.canResolve = true
    mocks.getAdminJobReports.mockReset()
    mocks.resolveAdminJobReport.mockReset()
    mocks.reverseAdminJobReport.mockReset()
    mocks.getAdminJobReports.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [REPORT],
    })
    mocks.resolveAdminJobReport.mockResolvedValue({ ...REPORT, status: 'upheld' })
  })

  it('resolves a pending report when the admin has permission', async () => {
    renderQueue()

    expect(screen.getByRole('heading', { name: 'Báo cáo vi phạm' })).toBeVisible()
    expect(await screen.findByText('Backend Engineer')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận vi phạm' }))
    fireEvent.change(screen.getByLabelText('Ghi chú xử lý'), {
      target: { value: 'Đã kiểm tra.' },
    })
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận vi phạm' }))

    await waitFor(() => expect(mocks.resolveAdminJobReport).toHaveBeenCalledWith('jrep_1', {
      status: 'upheld',
      note: 'Đã kiểm tra.',
    }))
  }, 10_000)

  it('keeps filters, ordering and pagination in the namespaced URL', async () => {
    renderQueue(
      '/admin/app/job-moderation?tab=reports&report_status=all&report_reason=scam&report_q=Acme&report_created_from=2026-07-01&report_created_to=2026-07-31&report_ordering=job_title&report_page=2',
    )

    await waitFor(() => expect(mocks.getAdminJobReports).toHaveBeenCalledWith({
      reason: 'scam',
      q: 'Acme',
      created_from: '2026-07-01',
      created_to: '2026-07-31',
      ordering: 'job_title',
      page: 2,
    }, { signal: expect.anything() }))
    expect(screen.getByTestId('location-search')).toHaveTextContent('tab=reports')
    expect(screen.getByTestId('location-search')).toHaveTextContent('report_page=2')
  })

  it('makes every data column sortable and sends both directions to the server', async () => {
    renderQueue('/admin/app/job-moderation?tab=reports&report_page=3')
    await screen.findByText('Backend Engineer')

    const sortableHeaders = document.querySelectorAll('th.ant-table-column-has-sorters')
    expect(sortableHeaders).toHaveLength(7)
    expect(screen.getByRole('columnheader', { name: 'Thao tác' }))
      .not.toHaveClass('ant-table-column-has-sorters')

    fireEvent.click(screen.getByRole('columnheader', { name: /Công ty/ }))
    await waitFor(() => expect(mocks.getAdminJobReports).toHaveBeenLastCalledWith({
      status: 'pending',
      ordering: 'company_name',
      page: 1,
    }, { signal: expect.anything() }))
    expect(screen.getByTestId('location-search')).toHaveTextContent(
      'report_ordering=company_name',
    )
    expect(screen.getByTestId('location-search')).not.toHaveTextContent('report_page=')

    fireEvent.click(screen.getByRole('columnheader', { name: /Công ty/ }))
    await waitFor(() => expect(mocks.getAdminJobReports).toHaveBeenLastCalledWith({
      status: 'pending',
      ordering: '-company_name',
      page: 1,
    }, { signal: expect.anything() }))
  })

  it('is read-only without resolve permission', async () => {
    mocks.canResolve = false
    renderQueue()

    expect(await screen.findByText('Bạn có quyền xem nhưng không có quyền xử lý báo cáo.')).toBeVisible()
    expect(await screen.findByText('Backend Engineer')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Xác nhận vi phạm' })).not.toBeInTheDocument()
    expect(screen.getByText('Chỉ xem')).toBeVisible()
  })

  it('requires an audit reason before reversing an upheld report', async () => {
    mocks.getAdminJobReports.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [{ ...REPORT, status: 'upheld' }],
    })
    mocks.reverseAdminJobReport.mockResolvedValue({ ...REPORT, status: 'dismissed' })
    renderQueue()

    fireEvent.click(await screen.findByRole('button', { name: 'Gỡ kết luận' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gỡ kết luận' }))
    expect(
      await within(dialog).findByText('Nhập lý do gỡ kết luận.'),
    ).toBeInTheDocument()
    expect(mocks.reverseAdminJobReport).not.toHaveBeenCalled()

    fireEvent.change(
      within(dialog).getByRole('textbox', { name: 'Lý do gỡ kết luận' }),
      { target: { value: 'Bằng chứng mới xác nhận tin không vi phạm.' } },
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gỡ kết luận' }))

    await waitFor(() => expect(mocks.reverseAdminJobReport).toHaveBeenCalledWith(
      'jrep_1',
      'Bằng chứng mới xác nhận tin không vi phạm.',
    ))
  })
})
