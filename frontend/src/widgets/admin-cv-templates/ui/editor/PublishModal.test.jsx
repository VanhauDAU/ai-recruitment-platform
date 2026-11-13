import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { withQueryClient } from '@/test/render-with-query-client'
import PublishModal from './PublishModal'

const template = { public_id: 'tpl_1', current_published_version_id: 3 }
const draft = { id: 9, version_number: 4 }
const checklist = (failing) => ({ items: [
  { key: 'names', ok: true, label: 'Có tên tiếng Việt và tiếng Anh' },
  { key: 'colors', ok: !failing, label: 'Có ít nhất một màu và một màu mặc định' },
  { key: 'test_pdf', ok: !failing, label: 'Đã xuất PDF thử thành công cho phiên bản này' },
] })
const renderModal = (props) => render(withQueryClient(<PublishModal open template={template} draft={draft} onClose={vi.fn()} onPublish={vi.fn()} canPublish {...props} />))

describe('PublishModal', () => {
  it('blocks publishing and says where to fix each failing check', () => {
    const onPublish = vi.fn()
    renderModal({ checklist: checklist(true), onPublish })

    expect(screen.getByRole('button', { name: 'Xuất bản' })).toBeDisabled()
    expect(screen.getByText('Chọn ít nhất một màu ở khối Màu & chữ.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Xuất PDF thử/ })).toBeInTheDocument()
    expect(onPublish).not.toHaveBeenCalled()
  })

  it('publishes once every check passes', () => {
    const onPublish = vi.fn()
    renderModal({ checklist: checklist(false), onPublish })

    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản' }))
    expect(onPublish).toHaveBeenCalled()
    expect(screen.getByText(/CV ứng viên đã tạo vẫn giữ phiên bản cũ/)).toBeInTheDocument()
  })

  it('explains when the admin cannot publish', () => {
    renderModal({ checklist: checklist(false), canPublish: false })

    expect(screen.getByText('Bạn cần quyền phát hành mẫu CV để xuất bản.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xuất bản' })).not.toBeInTheDocument()
  })
})
