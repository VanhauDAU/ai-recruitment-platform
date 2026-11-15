import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AvatarEditorModal from './AvatarEditorModal'

const { deleteAvatar, uploadAvatar, setCurrentUser, session } = vi.hoisted(() => ({
  deleteAvatar: vi.fn(),
  uploadAvatar: vi.fn(),
  setCurrentUser: vi.fn(),
  session: { user: null },
}))

vi.mock('../api/edit-profile.api', () => ({ deleteAvatar, uploadAvatar }))
vi.mock('@/entities/session', () => ({ useSession: () => ({ user: session.user, setCurrentUser }) }))
vi.mock('@/shared/lib/toast', () => ({ message: { success: vi.fn(), error: vi.fn() } }))

function renderModal(onClose = vi.fn()) {
  render(<AvatarEditorModal open onClose={onClose} />)
  return onClose
}

describe('AvatarEditorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.user = { avatar_url: 'https://cdn.example/avatar.jpg' }
  })

  it('shows the current avatar and the TopCV-style controls', () => {
    renderModal()

    expect(screen.getByRole('heading', { name: 'Chỉnh sửa ảnh đại diện' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Ảnh đại diện hiện tại' })).toHaveAttribute('src', 'https://cdn.example/avatar.jpg')
    expect(screen.getByRole('button', { name: 'Đổi ảnh' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Xóa ảnh' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Xong' })).toBeEnabled()
  })

  it('rejects unsupported or oversized files before reading them', async () => {
    renderModal()
    // rc-upload gắn lại <input> sau mỗi lần chọn tệp nên phải truy vấn lại.
    const fileInput = () => document.querySelector('input[type="file"]')

    fireEvent.change(fileInput(), { target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.')

    const big = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
    fireEvent.change(fileInput(), { target: { files: [big] } })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('không được vượt quá 5 MB'))
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it('removes the avatar only after confirming with "Xong"', async () => {
    deleteAvatar.mockResolvedValue({ avatar_url: '' })
    const onClose = renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Xóa ảnh' }))
    expect(screen.queryByRole('img', { name: 'Ảnh đại diện hiện tại' })).not.toBeInTheDocument()
    expect(deleteAvatar).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Xong' }))
    await waitFor(() => expect(setCurrentUser).toHaveBeenCalledWith({ avatar_url: '' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes without saving anything', () => {
    const onClose = renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Xóa ảnh' }))
    fireEvent.click(screen.getByRole('button', { name: 'Đóng lại (Không lưu)' }))

    expect(onClose).toHaveBeenCalled()
    expect(deleteAvatar).not.toHaveBeenCalled()
    expect(uploadAvatar).not.toHaveBeenCalled()
  })
})
