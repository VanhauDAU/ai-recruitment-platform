import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_AUTO_REJECTION_EMAIL } from '../model/job-form-values'
import AutomaticApplicationStatusFields from './AutomaticApplicationStatusFields'

// As served by GET /v2/applications/rules/.
vi.mock('@/entities/application/application', async (importOriginal) => ({
  ...(await importOriginal()),
  useApplicationRules: () => ({
    auto_reject_after_day_choices: [{ value: 14, label: '2 tuần' }, { value: 21, label: '3 tuần' }],
    auto_rejection_warning_days: 3,
    auto_rejection_email_grace_days: 3,
  }),
}))

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
  it('shows the default three-week policy from the served rules and editable candidate email', () => {
    render(<TestForm />)

    expect(screen.getByRole('heading', { name: 'Tự động cập nhật trạng thái hồ sơ' })).toBeInTheDocument()
    expect(screen.getByTitle('3 tuần')).toBeInTheDocument()
    expect(screen.getByText(/nhắc trước 3 ngày/)).toBeInTheDocument()
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
