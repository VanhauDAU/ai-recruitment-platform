import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CompanyReportQueue from './CompanyReportQueue'

const mocks = vi.hoisted(() => ({
  permissions: new Set(),
  getAdminCompanyReports: vi.fn(),
  resolveAdminCompanyReport: vi.fn(),
  reverseAdminCompanyReport: vi.fn(),
}))

vi.mock('@/entities/admin-access', () => ({
  useAdminAccess: () => ({ has: (code) => mocks.permissions.has(code) }),
}))
vi.mock('@/entities/session', () => ({ useSession: () => ({ user: { role: 'admin' } }) }))
vi.mock('@/entities/company-report', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminCompanyReports: mocks.getAdminCompanyReports,
  resolveAdminCompanyReport: mocks.resolveAdminCompanyReport,
  reverseAdminCompanyReport: mocks.reverseAdminCompanyReport,
}))
vi.mock('@/shared/lib/toast', () => ({ message: { error: vi.fn(), success: vi.fn() } }))

const REPORT = {
  public_id: 'crp_1',
  company: { public_id: 'co_ab12', slug: 'fpt-software', display_name: 'FPT Software', logo_url: '', content_policy_hold: false },
  reporter_email: 'candidate@example.com',
  reason: 'impersonation',
  reason_label: 'Mạo danh doanh nghiệp khác',
  section_key: 'about',
  section_title: 'Giới thiệu công ty',
  detail: 'Trang dùng tên của doanh nghiệp khác.',
  status: 'pending',
  resolution_note: '',
  resolved_at: null,
  resolved_by_email: '',
  resolution_history: [],
  created_at: '2026-11-14T01:00:00Z',
}
const ROUTE = '/admin/app/company-reports'

function listOf(...reports) {
  return { count: reports.length, next: null, previous: null, results: reports }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderQueue(initialEntry = ROUTE) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App>
          <CompanyReportQueue />
          <LocationProbe />
        </App>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const lastParams = () => mocks.getAdminCompanyReports.mock.lastCall[0]

describe('CompanyReportQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.permissions = new Set(['company_report.view', 'company_report.resolve', 'company_page.moderate', 'company.view'])
    mocks.getAdminCompanyReports.mockResolvedValue(listOf(REPORT))
    mocks.resolveAdminCompanyReport.mockResolvedValue({ ...REPORT, status: 'upheld' })
  })

  it('lists pending reports with the related section and a link to the admin company page', async () => {
    renderQueue()

    const company = await screen.findByRole('link', { name: 'FPT Software' })
    expect(company).toHaveAttribute('href', '/admin/app/companies/co_ab12?tab=public-page')
    expect(screen.getByText('Mạo danh doanh nghiệp khác')).toBeVisible()
    expect(screen.getByText('Phần: Giới thiệu công ty')).toBeVisible()
    expect(screen.queryByText('Đang tạm ẩn')).not.toBeInTheDocument()
    expect(screen.getByText(/1 báo cáo phù hợp/)).toBeVisible()
    expect(mocks.getAdminCompanyReports).toHaveBeenCalledWith(
      { status: 'pending', ordering: '-created_at', page: 1 },
      { signal: expect.anything() },
    )
  })

  it('marks a hidden company and does not link it for admins who cannot open companies', async () => {
    mocks.permissions.delete('company.view')
    mocks.getAdminCompanyReports.mockResolvedValue(
      listOf({ ...REPORT, section_title: '', company: { ...REPORT.company, content_policy_hold: true } }),
    )
    renderQueue()

    expect(await screen.findByText('Đang tạm ẩn')).toBeVisible()
    expect(screen.getByText('FPT Software')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'FPT Software' })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Phần:/)).not.toBeInTheDocument()
  })

  it('requires a note to uphold a report and can hide the company page with it', async () => {
    renderQueue()

    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận vi phạm' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận vi phạm' }))
    expect(await within(dialog).findByText('Nhập ghi chú xử lý.')).toBeInTheDocument()
    expect(mocks.resolveAdminCompanyReport).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText('Ghi chú xử lý'), { target: { value: ' Đã đối chiếu giấy phép. ' } })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Đồng thời tạm ẩn trang công ty' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận vi phạm' }))

    await waitFor(() => expect(mocks.resolveAdminCompanyReport).toHaveBeenCalledWith('crp_1', {
      status: 'upheld',
      note: 'Đã đối chiếu giấy phép.',
      apply_hold: true,
    }))
    await waitFor(() => expect(mocks.getAdminCompanyReports).toHaveBeenCalledTimes(2))
  })

  it('offers no page hold to admins who cannot moderate company pages', async () => {
    mocks.permissions.delete('company_page.moderate')
    renderQueue()

    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận vi phạm' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Ghi chú xử lý'), { target: { value: 'Đã xác minh.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận vi phạm' }))

    await waitFor(() => expect(mocks.resolveAdminCompanyReport).toHaveBeenCalledWith('crp_1', {
      status: 'upheld',
      note: 'Đã xác minh.',
      apply_hold: false,
    }))
  })

  it('dismisses a report with a note and never offers a hold', async () => {
    renderQueue()

    fireEvent.click(await screen.findByRole('button', { name: 'Bác bỏ báo cáo' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Ghi chú xử lý'), { target: { value: 'Thông tin trên trang là đúng.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bác báo cáo' }))

    await waitFor(() => expect(mocks.resolveAdminCompanyReport).toHaveBeenCalledWith('crp_1', {
      status: 'dismissed',
      note: 'Thông tin trên trang là đúng.',
      apply_hold: false,
    }))
  })

  it.each(['upheld', 'dismissed'])('requires an audit reason before reopening a report that was %s', async (status) => {
    mocks.getAdminCompanyReports.mockResolvedValue(listOf({ ...REPORT, status }))
    mocks.reverseAdminCompanyReport.mockResolvedValue(REPORT)
    renderQueue()

    fireEvent.click(await screen.findByRole('button', { name: 'Gỡ kết luận' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/quay lại hàng chờ xử lý.*không tự khôi phục trang công ty/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gỡ kết luận' }))
    expect(await within(dialog).findByText('Nhập lý do gỡ kết luận.')).toBeInTheDocument()
    expect(mocks.reverseAdminCompanyReport).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText('Lý do gỡ kết luận'), { target: { value: 'Bằng chứng mới.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gỡ kết luận' }))

    await waitFor(() => expect(mocks.reverseAdminCompanyReport).toHaveBeenCalledWith('crp_1', 'Bằng chứng mới.'))
  })

  it('is read-only without the resolve permission', async () => {
    mocks.permissions.delete('company_report.resolve')
    renderQueue()

    expect(await screen.findByText('Bạn có quyền xem nhưng không có quyền xử lý báo cáo.')).toBeVisible()
    expect(await screen.findByText('Chỉ xem')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Xác nhận vi phạm' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bác bỏ báo cáo' })).not.toBeInTheDocument()
  })

  it('keeps filters, ordering and page in the URL and narrows to one company', async () => {
    renderQueue(`${ROUTE}?status=all&reason=scam&q=FPT&ordering=company_name&page=2`)

    await waitFor(() => expect(lastParams()).toEqual({ reason: 'scam', q: 'FPT', ordering: 'company_name', page: 2 }))

    fireEvent.click(await screen.findByRole('button', { name: 'Chỉ xem báo cáo của công ty này' }))
    await waitFor(() => expect(lastParams()).toEqual({
      reason: 'scam',
      company: 'co_ab12',
      q: 'FPT',
      ordering: 'company_name',
      page: 1,
    }))
    expect(screen.getByTestId('location')).toHaveTextContent('company=co_ab12')
    expect(screen.getByTestId('location')).not.toHaveTextContent('page=')
    expect(await screen.findByText('Công ty: FPT Software')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Chỉ xem báo cáo của công ty này' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Xóa 4 bộ lọc/ }))
    await waitFor(() => expect(lastParams()).toEqual({ status: 'pending', ordering: '-created_at', page: 1 }))
    expect(screen.getByTestId('location')).toHaveTextContent(ROUTE)
    expect(screen.getByTestId('location')).not.toHaveTextContent('?')
  })

  it('sorts every data column on the server in both directions', async () => {
    renderQueue(`${ROUTE}?page=3`)
    await screen.findByText('FPT Software')

    expect(document.querySelectorAll('th.ant-table-column-has-sorters')).toHaveLength(6)
    expect(screen.getByRole('columnheader', { name: 'Thao tác' })).not.toHaveClass('ant-table-column-has-sorters')

    fireEvent.click(screen.getByRole('columnheader', { name: /Công ty/ }))
    await waitFor(() => expect(lastParams()).toEqual({ status: 'pending', ordering: 'company_name', page: 1 }))
    expect(screen.getByTestId('location')).toHaveTextContent('ordering=company_name')
    expect(screen.getByTestId('location')).not.toHaveTextContent('page=')

    fireEvent.click(screen.getByRole('columnheader', { name: /Công ty/ }))
    await waitFor(() => expect(lastParams().ordering).toBe('-company_name'))

    // Bỏ chọn sorter về mặc định (mới nhất trước); bấm tiếp cột thời điểm để sắp tăng dần.
    fireEvent.click(screen.getByRole('columnheader', { name: /Công ty/ }))
    await waitFor(() => expect(lastParams().ordering).toBe('-created_at'))
    fireEvent.click(screen.getByRole('columnheader', { name: /Thời điểm báo cáo/ }))
    await waitFor(() => expect(lastParams().ordering).toBe('created_at'))
  })
})
