import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import AdminJobDetail from './AdminJobDetail'

const { getAdminJob, useSession } = vi.hoisted(() => ({
  getAdminJob: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock('@/entities/admin-job', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminJob,
}))
vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/features/enforce-job-visibility', () => ({
  JobVisibilityActions: () => null,
}))

const job = {
  public_id: 'jb_1',
  title: 'Backend Engineer',
  company_name: 'ProCV',
  status: 'active',
  status_label: 'Đang tuyển',
  description: '<p>Mô tả</p>',
  requirements: '<p>Yêu cầu</p>',
  benefits: '<p>Quyền lợi</p>',
  job_locations: [],
  status_history: [],
  moderation_events: [],
  reports: [],
  blocked_reasons: [],
  state_actions: ['hide'],
  content_changes: { has_baseline: false, changed_count: 0, changes: [] },
}

function renderDetail({ data = job, permissions = [], serviceContent = null } = {}) {
  getAdminJob.mockResolvedValue(data)
  useSession.mockReturnValue({ user: { admin_access: { permissions } } })
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AdminJobDetail publicId="jb_1" serviceContent={serviceContent} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminJobDetail', () => {
  it('shows one tab panel at a time instead of a stack of collapsibles', async () => {
    renderDetail()

    await waitFor(() => expect(screen.getByText('Nội dung tuyển dụng')).toBeVisible())
    expect(screen.queryByText('Lịch sử xử lý')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử' }))

    expect(screen.getByText('Lịch sử xử lý')).toBeVisible()
    expect(screen.queryByText('Nội dung tuyển dụng')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Lịch sử' })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens on the change diff when the employer edited a published job', async () => {
    getAdminJob.mockResolvedValue({
      ...job,
      content_changes: {
        has_baseline: true,
        baseline_captured_at: '2026-08-01T03:00:00Z',
        changed_count: 1,
        hidden_sensitive_count: 0,
        changes: [{
          key: 'title',
          label: 'Tiêu đề tin',
          kind: 'text',
          sensitive: false,
          before: 'A',
          after: 'B',
        }],
      },
    })
    useSession.mockReturnValue({ user: { admin_access: { permissions: [] } } })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <AdminJobDetail publicId="jb_1" />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('Thay đổi sau khi đăng')).toBeVisible())
    expect(screen.getByRole('tab', { name: /Thay đổi/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('does not expose the service tab when the route does not provide authorized content', async () => {
    renderDetail()

    await waitFor(() => expect(screen.getByText('Nội dung tuyển dụng')).toBeVisible())
    expect(screen.queryByRole('tab', { name: 'Dịch vụ' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('job-service-activations')).not.toBeInTheDocument()
  })

  it('opens the job service content supplied by the route composition', async () => {
    renderDetail({
      serviceContent: <div data-testid="job-service-activations">Dịch vụ của Backend Engineer</div>,
    })
    await waitFor(() => expect(screen.getByText('Nội dung tuyển dụng')).toBeVisible())

    fireEvent.click(screen.getByRole('tab', { name: 'Dịch vụ' }))

    const panel = screen.getByTestId('job-service-activations')
    expect(panel).toHaveTextContent('Dịch vụ của Backend Engineer')
  })

  it('shows when the recruiter accepted the publication commitment', async () => {
    renderDetail({
      data: {
        ...job,
        responsibility_accepted_at: '2026-11-12T08:00:00+07:00',
        responsibility_statement_version: '2026-11',
      },
    })

    expect(await screen.findByText(/NTD đã cam kết/)).toBeInTheDocument()
    expect(screen.queryByText('Chưa ghi nhận cam kết')).not.toBeInTheDocument()
  })

  it('flags a public job that has no commitment on record', async () => {
    renderDetail()

    expect(await screen.findByText('Chưa ghi nhận cam kết')).toBeInTheDocument()
  })

  it('links to the employer verification file when compliance blocks the job', async () => {
    getAdminJob.mockResolvedValue({
      ...job,
      employer_public_id: 'usr_employer',
      blocked_reasons: [
        { code: 'verification_required', label: 'Nhà tuyển dụng chưa được duyệt xác thực.' },
      ],
    })
    useSession.mockReturnValue({
      user: { admin_access: { permissions: ['employer_verification.view'] } },
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <AdminJobDetail publicId="jb_1" />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const link = await screen.findByRole('link', { name: 'Mở hồ sơ xác thực' })
    expect(link).toHaveAttribute('href', '/admin/app/recruiters/usr_employer?tab=verification')
    expect(screen.queryByRole('button', { name: 'Duyệt tin' })).not.toBeInTheDocument()
  })
})
