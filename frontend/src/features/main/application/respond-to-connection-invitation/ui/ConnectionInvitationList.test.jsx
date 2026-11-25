import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConnectionInvitationList from './ConnectionInvitationList'

const api = vi.hoisted(() => ({ getMyConnectionInvitations: vi.fn(), respondToConnectionInvitation: vi.fn() }))
vi.mock('@/entities/application/application', async (importOriginal) => ({ ...(await importOriginal()), ...api }))
vi.mock('@/shared/lib/toast', () => ({ message: { success: vi.fn(), error: vi.fn() } }))

const invitation = (publicId, status = 'pending') => ({
  public_id: publicId, status, invited_at: '2026-11-25T09:00:00+07:00', responded_at: null,
  company_name: `Công ty ${publicId}`, company_slug: 'cong-ty', company_logo_url: null,
  job_public_id: 'job_1', job_title: 'Backend Developer', job_slug: 'backend-developer', job_stopped_at: null,
})

function renderList() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><ConnectionInvitationList /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ConnectionInvitationList', () => {
  beforeEach(() => {
    api.getMyConnectionInvitations.mockReset()
    api.respondToConnectionInvitation.mockReset()
      .mockImplementation(async (publicId, accept) => ({ ...invitation(publicId), status: accept ? 'accepted' : 'declined' }))
  })

  it('hiện trạng thái rỗng khi chưa có lời mời', async () => {
    api.getMyConnectionInvitations.mockResolvedValue([])
    renderList()
    expect(await screen.findByText('Bạn chưa có lời mời kết nối nào')).toBeInTheDocument()
  })

  it('đồng ý thì hiện nút Nhắn tin, từ chối phải xác nhận', async () => {
    const user = userEvent.setup()
    api.getMyConnectionInvitations.mockResolvedValue([invitation('csi_a'), invitation('csi_b')])
    renderList()

    await screen.findByText('Công ty csi_a')
    const [first, second] = screen.getAllByRole('listitem')
    await user.click(within(first).getByRole('button', { name: 'Đồng ý' }))
    expect(await within(first).findByRole('button', { name: /Nhắn tin/ })).toBeDisabled()
    expect(api.respondToConnectionInvitation).toHaveBeenCalledWith('csi_a', true)

    await user.click(within(second).getByRole('button', { name: 'Từ chối' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Từ chối' }))
    await waitFor(() => expect(api.respondToConnectionInvitation).toHaveBeenCalledWith('csi_b', false))
    expect(await within(second).findByText('Đã từ chối')).toBeInTheDocument()
  })
})
