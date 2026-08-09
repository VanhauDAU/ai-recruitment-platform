import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import JobSubmissionReviewActions from './JobSubmissionReviewActions'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))
vi.mock('@/entities/session', () => ({ useSession }))

function renderActions(job) {
  useSession.mockReturnValue({
    user: {
      admin_access: {
        permissions: ['job_moderation.approve', 'job_moderation.reject'],
      },
    },
  })
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <JobSubmissionReviewActions
        job={{ public_id: 'jb_1', status: 'pending', review_token: 'token', ...job }}
      />
    </QueryClientProvider>,
  )
}

describe('JobSubmissionReviewActions', () => {
  it('keeps the approve button visible but disabled when the job is blocked', () => {
    renderActions({
      state_actions: ['reject'],
      approve_blockers: [{ code: 'moderation_hold', label: 'Tạm ẩn để rà soát nội dung' }],
      approve_requirements: [],
    })

    expect(screen.getByRole('button', { name: 'Duyệt tin' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeEnabled()
  })

  it('renders canonical verification and DPA blockers from the backend', () => {
    renderActions({
      state_actions: ['reject'],
      approve_blockers: [
        { code: 'verification_required', label: 'Nhà tuyển dụng chưa được duyệt xác thực.' },
        { code: 'dpa_outdated', label: 'Nhà tuyển dụng chưa có chấp thuận DPA còn hiệu lực.' },
      ],
      approve_requirements: [],
    })

    const approve = screen.getByRole('button', { name: 'Duyệt tin' })
    expect(approve).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeEnabled()
  })

  it('requires a new deadline before approving an expired submission', () => {
    renderActions({
      state_actions: ['approve', 'reject'],
      approve_blockers: [],
      approve_requirements: [{ code: 'deadline', label: 'Hạn nhận hồ sơ đã qua.' }],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Duyệt tin' }))

    expect(screen.getByText('Hạn nhận hồ sơ mới')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duyệt và công khai' })).toBeDisabled()
  })

  it('approves directly when nothing else is required', () => {
    renderActions({
      state_actions: ['approve', 'reject'],
      approve_blockers: [],
      approve_requirements: [],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Duyệt tin' }))

    expect(screen.queryByText('Hạn nhận hồ sơ mới')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duyệt và công khai' })).toBeEnabled()
  })
})
