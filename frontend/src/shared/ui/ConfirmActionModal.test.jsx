import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, ConfigProvider } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import ConfirmAction from './ConfirmAction'
import ConfirmActionModal from './ConfirmActionModal'
import useConfirmAction from './use-confirm-action'

function HookHarness({ onCancel, onConfirm, onDismiss }) {
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  return (
    <>
      <Button onClick={() => requestConfirmation({
        danger: true,
        description: 'Nội dung sẽ bị xóa vĩnh viễn.',
        onCancel,
        onConfirm,
        onDismiss,
        title: 'Xóa nội dung',
      })}
      >
        Mở xác nhận
      </Button>
      {confirmationModal}
    </>
  )
}

describe('ConfirmActionModal', () => {
  it('renders the standard accessible confirmation layout', () => {
    render(
      <ConfirmActionModal
        danger
        description={<>Bạn có chắc muốn xóa <strong>thực tập sinh</strong> không?</>}
        onCancel={() => {}}
        onConfirm={() => {}}
        open
        title="Xóa thông báo"
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Xóa thông báo' })).toBeInTheDocument()
    expect(screen.getByText('thực tập sinh')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đóng' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Đóng hộp thoại' })).toBeInTheDocument()
  })

  it('keeps cancel and dismiss behavior distinct', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onDismiss = vi.fn()
    const { rerender } = render(
      <ConfirmActionModal
        onCancel={onCancel}
        onConfirm={() => {}}
        onDismiss={onDismiss}
        open
        title="Xác nhận"
      >
        Nội dung
      </ConfirmActionModal>,
    )

    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onDismiss).not.toHaveBeenCalled()

    rerender(
      <ConfirmActionModal
        onCancel={onCancel}
        onConfirm={() => {}}
        onDismiss={onDismiss}
        open
        title="Xác nhận"
      >
        Nội dung
      </ConfirmActionModal>,
    )
    await user.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('locks every dismissal path while an action is pending', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmActionModal
        confirmLoading
        onCancel={onCancel}
        onConfirm={() => {}}
        open
        title="Đang xử lý"
      >
        Vui lòng chờ
      </ConfirmActionModal>,
    )

    expect(screen.getByRole('button', { name: 'Đóng' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Đóng hộp thoại' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })
})

describe('ConfirmAction', () => {
  it('waits for the action and restores focus after success', async () => {
    const user = userEvent.setup()
    const action = vi.fn(() => new Promise((resolve) => window.setTimeout(resolve, 30)))
    render(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <ConfirmAction
          danger
          description="Thao tác này không thể hoàn tác."
          onConfirm={action}
          title="Xóa dữ liệu"
        >
          <Button>Xóa</Button>
        </ConfirmAction>
      </ConfigProvider>,
    )

    const trigger = screen.getByRole('button', { name: 'Xóa' })
    await user.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(action).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeDisabled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('prevents duplicate submits and keeps the dialog open after a failed action', async () => {
    const user = userEvent.setup()
    const deferred = Promise.withResolvers()
    const onConfirmError = vi.fn()
    const action = vi.fn(() => deferred.promise)
    render(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <ConfirmAction
          danger
          description="Dữ liệu sẽ không thể khôi phục."
          onConfirm={action}
          onConfirmError={onConfirmError}
          title="Xóa dữ liệu"
        >
          <Button>Xóa</Button>
        </ConfirmAction>
      </ConfigProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Xóa' }))
    const confirmButton = screen.getByRole('button', { name: 'Xác nhận' })
    fireEvent.click(confirmButton)
    fireEvent.click(confirmButton)
    expect(action).toHaveBeenCalledOnce()

    deferred.reject(new Error('request_failed'))
    await waitFor(() => expect(onConfirmError).toHaveBeenCalledOnce())
    expect(screen.getByRole('dialog', { name: 'Xóa dữ liệu' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeEnabled()
  })
})

describe('useConfirmAction', () => {
  it('uses dismiss instead of destructive cancel for the close control', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onDismiss = vi.fn()
    render(<HookHarness onCancel={onCancel} onConfirm={() => {}} onDismiss={onDismiss} />)

    await user.click(screen.getByRole('button', { name: 'Mở xác nhận' }))
    await user.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }))

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })
})
