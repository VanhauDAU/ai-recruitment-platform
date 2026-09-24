import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import JobSubmissionReviewActions from './JobSubmissionReviewActions'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))
vi.mock('@/entities/session', () => ({ useSession }))

function renderActions(job, permissions = [
  'job_moderation.approve',
  'job_moderation.reject',
]) {
  useSession.mockReturnValue({
    user: {
      admin_access: {
        permissions,
      },
    },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <JobSubmissionReviewActions
          job={{ public_id: 'jb_1', status: 'pending', review_token: 'token', ...job }}
        />
      </QueryClientProvider>
    </MemoryRouter>,
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
      employer_public_id: 'usr_employer',
      state_actions: ['reject'],
      approve_blockers: [
        { code: 'verification_required', label: 'Nhà tuyển dụng chưa được duyệt xác thực.' },
        { code: 'dpa_outdated', label: 'Nhà tuyển dụng chưa có chấp thuận DPA còn hiệu lực.' },
      ],
      approve_requirements: [],
    }, [
      'job_moderation.approve',
      'job_moderation.reject',
      'employer_verification.view',
    ])

    const approve = screen.getByRole('button', { name: 'Duyệt tin' })
    expect(approve).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Mở hồ sơ xác thực' })).toHaveAttribute(
      'href',
      '/admin/app/recruiters/usr_employer?tab=verification',
    )
  })

  it('does not expose the recruiter deep link without verification view permission', () => {
    renderActions({
      employer_public_id: 'usr_employer',
      state_actions: ['reject'],
      approve_blockers: [
        { code: 'verification_required', label: 'Nhà tuyển dụng chưa được duyệt xác thực.' },
      ],
      approve_requirements: [],
    })

    expect(screen.queryByRole('link', { name: 'Mở hồ sơ xác thực' }))
      .not.toBeInTheDocument()
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
