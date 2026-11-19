import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Form } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import ActionDialog from './ActionDialog'
import ReasonField from './ReasonField'

function renderDialog(props = {}) {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  function Harness() {
    const [form] = Form.useForm()
    return (
      <ActionDialog
        open
        title="Tạm khóa tài khoản"
        target="Nguyễn An · an@example.com"
        submitLabel="Tạm khóa"
        tone="danger"
        onCancel={onCancel}
        onSubmit={onSubmit}
        {...props}
      >
        <Form form={form} initialValues={{ reason: '' }}>
          <ReasonField label="Lý do" presets={['Nghi lộ mật khẩu']} />
        </Form>
      </ActionDialog>
    )
  }
  render(<Harness />)
  return { onCancel, onSubmit }
}

describe('ActionDialog', () => {
  it('names the target, labels the action with its verb and submits with Ctrl+Enter', () => {
    const { onSubmit } = renderDialog()
    expect(screen.getByText('Nguyễn An · an@example.com')).toBeInTheDocument()
    const submit = screen.getByText('Tạm khóa').closest('button')
    expect(submit).toHaveClass('ant-btn-dangerous')

    fireEvent.keyDown(screen.getByLabelText('Lý do'), { key: 'Enter', ctrlKey: true })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(screen.getByLabelText('Lý do'), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('fills the reason from a preset chip', async () => {
    renderDialog()
    const chip = screen.getByText('Nghi lộ mật khẩu', { selector: 'button' })
    fireEvent.click(chip)
    expect(screen.getByLabelText('Lý do')).toHaveValue('Nghi lộ mật khẩu')
    await waitFor(() => expect(chip).toHaveAttribute('aria-pressed', 'true'))
  })

  it('locks submit and cancel while the action is running', () => {
    const { onCancel, onSubmit } = renderDialog({ loading: true })
    fireEvent.keyDown(screen.getByLabelText('Lý do'), { key: 'Enter', metaKey: true })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Hủy').closest('button')).toBeDisabled()
    expect(onCancel).not.toHaveBeenCalled()
  })
})
