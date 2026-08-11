import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { describe, expect, it } from 'vitest'
import { DEFAULT_AUTO_REJECTION_EMAIL } from '../model/job-form-values'
import AutomaticApplicationStatusFields from './AutomaticApplicationStatusFields'

function TestForm() {
  return (
    <Form initialValues={{
      auto_reject_stale_applications: true,
      auto_reject_after_days: 21,
      auto_rejection_email_body: DEFAULT_AUTO_REJECTION_EMAIL,
    }}>
      <AutomaticApplicationStatusFields />
    </Form>
  )
}

describe('AutomaticApplicationStatusFields', () => {
  it('shows the default three-week policy and editable candidate email', () => {
    render(<TestForm />)

    expect(screen.getByRole('heading', { name: 'Tự động cập nhật trạng thái hồ sơ' })).toBeInTheDocument()
    expect(screen.getByTitle('3 tuần')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Nội dung email từ chối' })).toHaveValue(DEFAULT_AUTO_REJECTION_EMAIL)
  })

  it('disables the policy controls when the switch is turned off', async () => {
    const user = userEvent.setup()
    render(<TestForm />)

    await user.click(screen.getByRole('switch', { name: 'Bật tự động cập nhật trạng thái hồ sơ' }))

    expect(screen.getByRole('combobox', { name: 'Thời hạn tự động chuyển hồ sơ' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Nội dung email từ chối' })).toBeDisabled()
  })
})
