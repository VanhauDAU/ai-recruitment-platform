import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AdminProfilePanel from './AdminProfilePanel'

vi.mock('@/entities/session', () => ({
  useSession: () => ({ user: { full_name: 'Quản trị viên', email: 'admin@example.com', avatar_url: '' }, setCurrentUser: vi.fn() }),
}))
vi.mock('@/entities/admin-access', () => ({ useAdminAccess: () => ({ isSuperuser: true }) }))
vi.mock('@/features/edit-profile', () => ({
  updateProfile: vi.fn(),
  AvatarEditorModal: ({ open }) => (open ? <div role="dialog" aria-label="avatar-editor" /> : null),
}))

describe('AdminProfilePanel', () => {
  it('opens the shared avatar editor instead of uploading the raw file', async () => {
    render(<AdminProfilePanel />)

    expect(screen.queryByRole('dialog', { name: 'avatar-editor' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Đổi ảnh đại diện/ }))
    expect(screen.getByRole('dialog', { name: 'avatar-editor' })).toBeInTheDocument()
  })
})
