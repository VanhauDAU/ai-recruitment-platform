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
vi.mock('@/features/review-job-submission', () => ({
  JobSubmissionReviewActions: () => <div>Hành động duyệt</div>,
}))
vi.mock('@/features/enforce-job-visibility', () => ({
  JobVisibilityActions: () => null,
}))

const job = {
  public_id: 'jb_1',
  title: 'Backend Engineer',
  company_name: 'ProCV',
  status: 'pending',
  status_label: 'Chờ duyệt',
  description: '<p>Mô tả</p>',
  requirements: '<p>Yêu cầu</p>',
  benefits: '<p>Quyền lợi</p>',
  job_locations: [],
  status_history: [],
  moderation_events: [],
  reports: [],
  blocked_reasons: [],
  approve_blockers: [],
  approve_requirements: [],
  state_actions: ['approve', 'reject'],
  pending_changes: { has_baseline: false, changed_count: 0, changes: [] },
}

function renderDetail() {
  getAdminJob.mockResolvedValue(job)
  useSession.mockReturnValue({ user: { admin_access: { permissions: [] } } })
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AdminJobDetail publicId="jb_1" />
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

  it('opens on the change diff when the employer edited an approved job', async () => {
    getAdminJob.mockResolvedValue({
      ...job,
      pending_changes: {
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

    await waitFor(() => expect(screen.getByText('Thay đổi cần duyệt')).toBeVisible())
    expect(screen.getByRole('tab', { name: /Thay đổi/ })).toHaveAttribute('aria-selected', 'true')
  })
})
