import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import EmployerAccountInformation from './EmployerAccountInformation'

vi.mock('@/entities/account/session', () => ({
  useSession: () => ({ user: { full_name: 'Nhà tuyển dụng', email: 'hr@example.com', avatar_url: '' }, setCurrentUser: vi.fn() }),
}))
vi.mock('@/entities/account/employer-profile', () => ({ getEmployerProfile: vi.fn().mockResolvedValue({}) }))
vi.mock('@/features/common/account/edit-profile', () => ({
  updateProfile: vi.fn(),
  AvatarEditorModal: ({ open }) => (open ? <div role="dialog" aria-label="avatar-editor" /> : null),
}))

describe('EmployerAccountInformation', () => {
  it('opens the shared avatar editor from "Đổi avatar"', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><EmployerAccountInformation /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.queryByRole('dialog', { name: 'avatar-editor' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Đổi avatar/ }))
    expect(screen.getByRole('dialog', { name: 'avatar-editor' })).toBeInTheDocument()
  })
})
