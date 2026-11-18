import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelMyCompanyJoinRequest, decideCompanyJoinRequest, getCompanyJoinRequests } from '@/entities/employer-profile'
import { withQueryClient } from '@/test/render-with-query-client'
import CompanyJoinRequestsPanel from './CompanyJoinRequestsPanel'
import PendingCompanyJoin from './PendingCompanyJoin'

vi.mock('@/entities/employer-profile', async (importOriginal) => ({
  ...(await importOriginal()),
  cancelMyCompanyJoinRequest: vi.fn(),
  decideCompanyJoinRequest: vi.fn(),
  getCompanyJoinRequests: vi.fn(),
}))

describe('company join flow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lets the requester cancel a request still waiting for the owner', async () => {
    cancelMyCompanyJoinRequest.mockResolvedValue()
    const onChanged = vi.fn()
    render(withQueryClient(
      <PendingCompanyJoin
        joinRequest={{ company_name: 'Acme Corp', created_at: '2026-11-16T02:00:00Z' }}
        onChanged={onChanged}
      />,
    ))

    expect(screen.getByText('Đang chờ duyệt tham gia Acme Corp')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Hủy yêu cầu' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('lets the company manager approve a pending request', async () => {
    getCompanyJoinRequests.mockResolvedValue([{
      public_id: 'cjr_1',
      requester_name: 'Trần Văn A',
      requester_email: 'a@acme.vn',
      requester_position: 'HR',
      can_decide: true,
      created_at: '2026-11-16T02:00:00Z',
    }])
    decideCompanyJoinRequest.mockResolvedValue({ status: 'approved' })
    render(withQueryClient(<CompanyJoinRequestsPanel />))

    await userEvent.click(await screen.findByRole('button', { name: /Duyệt$/ }))
    await waitFor(() => expect(decideCompanyJoinRequest).toHaveBeenCalledWith('cjr_1', 'approve'))
  })

  it('tells an unverified company manager to verify before deciding', async () => {
    getCompanyJoinRequests.mockResolvedValue([{
      public_id: 'cjr_2',
      requester_name: 'Lê B',
      can_decide: false,
      created_at: '2026-11-16T02:00:00Z',
    }])
    render(withQueryClient(<CompanyJoinRequestsPanel />))

    expect(await screen.findByText('Bạn cần xác thực tài khoản trước khi duyệt yêu cầu tham gia.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Duyệt$/ })).toBeDisabled()
  })

  it('says an administrator decides when the company has no verified owner', () => {
    render(withQueryClient(
      <PendingCompanyJoin
        joinRequest={{ company_name: 'Acme Corp', created_at: '2026-11-16T02:00:00Z', awaiting_admin: true }}
        onChanged={vi.fn()}
      />,
    ))

    expect(screen.getByText(/quản trị viên ProCV sẽ duyệt/)).toBeInTheDocument()
  })
})
