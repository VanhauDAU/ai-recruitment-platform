import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import AdminDashboardOverview from './AdminDashboardOverview'

const { getAdminDashboard } = vi.hoisted(() => ({ getAdminDashboard: vi.fn() }))

vi.mock('@/entities/dashboard/admin-dashboard', async (importOriginal) => ({
  ...await importOriginal(),
  getAdminDashboard,
}))
vi.mock('recharts', async (importOriginal) => ({
  ...await importOriginal(),
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}))

const zeroReports = { new: 0, upheld: 0, dismissed: 0 }
const payload = {
  generated_at: '2026-11-16T03:00:00Z',
  period: { days: 7, start: '2026-11-10', end: '2026-11-16' },
  queues: [
    { key: 'job_reports', count: 0, overdue: 0, oldest_at: null, sla_hours: 48 },
    { key: 'company_reports', count: 0, overdue: 0, oldest_at: null, sla_hours: 48 },
  ],
  kpis: {
    candidates: { current: 3, previous: 2 },
    employers: { current: 0, previous: 0 },
    jobs: { current: 1, previous: 4 },
    applications: { current: 0, previous: 0 },
  },
  activity: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-11-${10 + index}`, candidates: 0, employers: 0, jobs: 0, applications: 0,
  })),
  totals: { candidates: 10, employers: 2, companies: 1, jobs_active: 4 },
  jobs: { states: { draft: 0, active: 4, hidden: 0, expired: 0, closed: 0 }, held: 0, without_applications: 4, expiring_soon: 0 },
  applications: {
    funnel: { submitted: 0, viewed: 0, shortlisted: 0, interviewed: 0, accepted: 0, rejected: 0, withdrawn: 0 },
    avg_first_view_hours: null,
    stale_unviewed: 0,
  },
  trust: { job_reports: zeroReports, company_reports: zeroReports, restricted_accounts: { candidates: 0, employers: 0 }, compliance_holds_active: 0 },
  content: { knowledge_review_overdue: 0 },
  top_categories: [],
  ai: {
    match_analyses: { total: 0, succeeded: 0, failed: 0 },
    generation: { invocations: 0, failures: 0, total_tokens: 0, cost_usd: 0, avg_latency_ms: null },
  },
}

function renderDashboard(url = '/admin/app/dashboard?period=7') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <AdminDashboardOverview displayName="An" tierLabel="Quản trị viên nghiệp vụ" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminDashboardOverview', () => {
  it('reads the period from the URL and shows empty states instead of blank panels', async () => {
    getAdminDashboard.mockResolvedValue(payload)
    renderDashboard()

    const queue = await screen.findByRole('region', { name: 'Cần xử lý' })
    expect(getAdminDashboard).toHaveBeenCalledWith(7, expect.anything())
    expect(within(queue).getByText(/Đã xử lý hết\. Hàng chờ mới/)).toBeInTheDocument()
    expect(screen.getByText('Chưa có hồ sơ nào được nộp trong kỳ này.')).toBeInTheDocument()
    expect(screen.getByText('Chưa có tin đang tuyển nào được gắn ngành nghề.')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /tin đang hiển thị cho ứng viên/ })).toHaveAttribute(
      'href',
      '/admin/app/job-moderation?job_scope=active',
    )
  })

  it('offers a retry when the dashboard cannot load', async () => {
    getAdminDashboard.mockRejectedValue(new Error('down'))
    renderDashboard('/admin/app/dashboard?period=12')

    expect(await screen.findByText('Không tải được số liệu bảng điều khiển.')).toBeInTheDocument()
    expect(getAdminDashboard).toHaveBeenLastCalledWith(30, expect.anything())
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })
})
