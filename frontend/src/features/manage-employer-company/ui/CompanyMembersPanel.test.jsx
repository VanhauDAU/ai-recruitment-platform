import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEmployerCompanyPageEditors } from '@/entities/employer-company-page'
import { getCompanyJoinRequests, transferCompanyOwnership } from '@/entities/employer-profile'
import { withQueryClient } from '@/test/render-with-query-client'
import CompanyMembersPanel from './CompanyMembersPanel'

vi.mock('@/entities/employer-profile', async (importOriginal) => ({
  ...(await importOriginal()),
  getCompanyJoinRequests: vi.fn(),
  transferCompanyOwnership: vi.fn(),
}))
vi.mock('@/entities/employer-company-page', async (importOriginal) => ({
  ...(await importOriginal()),
  getEmployerCompanyPageEditors: vi.fn(),
}))

describe('company members tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCompanyJoinRequests.mockResolvedValue([])
    getEmployerCompanyPageEditors.mockResolvedValue([
      { member_id: 'own_1', display_name: 'Chủ A', company_role: 'owner', eligible: true },
      { member_id: 'mem_1', display_name: 'Thành viên B', company_role: 'member', eligible: true },
      { member_id: 'mem_2', display_name: 'Thành viên C', company_role: 'member', eligible: false },
    ])
  })

  it('offers the transfer only to verified members and confirms it', async () => {
    transferCompanyOwnership.mockResolvedValue()
    const onRefresh = vi.fn()
    render(withQueryClient(<CompanyMembersPanel onRefresh={onRefresh} />))

    expect(await screen.findByText('Duyệt tham gia công ty')).toBeInTheDocument()
    const buttons = await screen.findAllByRole('button', { name: 'Chuyển quyền owner' })
    expect(buttons).toHaveLength(1)

    await userEvent.click(buttons[0])
    await userEvent.click(await screen.findByRole('button', { name: 'Chuyển quyền' }))

    await waitFor(() => expect(transferCompanyOwnership).toHaveBeenCalledWith('mem_1'))
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
  })
})
