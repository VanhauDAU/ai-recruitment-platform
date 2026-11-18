import { fireEvent, render, screen } from '@testing-library/react'
import { App } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import AvatarUploadModal from './AvatarUploadModal'

describe('AvatarUploadModal', () => {
  it('shows a draggable crop frame, centered preview and staged completion controls', () => {
    const onClose = vi.fn()
    const onComplete = vi.fn()
    render(<App><AvatarUploadModal open avatar={{ url: '/avatar.jpg', width: 900, height: 700 }} position={{ x: 35, y: 60 }} zoom={1.5} onClose={onClose} onAvatarUpload={vi.fn()} onComplete={onComplete} /></App>)

    expect(screen.getByRole('dialog', { name: 'Cập nhật ảnh đại diện' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Vùng căn chỉnh ảnh đại diện' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Xem trước ảnh đại diện' })).toHaveStyle({ transform: 'scale(1.5)' })
    expect(screen.getByRole('button', { name: 'Đổi ảnh' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa ảnh' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }))
    expect(onComplete).toHaveBeenCalledWith({
      avatar: null,
      removed: false,
      position: { x: 35, y: 60 },
      zoom: 1.5,
    })
    expect(onClose).toHaveBeenCalled()
  })
})
