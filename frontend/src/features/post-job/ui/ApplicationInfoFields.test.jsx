import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Button, Form } from 'antd'
import dayjs from 'dayjs'
import { describe, expect, it, vi } from 'vitest'
import ApplicationInfoFields from './ApplicationInfoFields'

function DeadlineHarness({ deadline, maxDeadlineDays = 90, onValid = vi.fn() }) {
  const [form] = Form.useForm()
  return (
    <Form form={form} initialValues={{ deadline }}>
      <ApplicationInfoFields
        campaigns={[]}
        maxDeadlineDays={maxDeadlineDays}
        onCreateCampaign={vi.fn()}
      />
      <Button
        onClick={() => form.validateFields(['deadline']).then(onValid).catch(() => {})}
      >
        Kiểm tra hạn
      </Button>
    </Form>
  )
}

describe('ApplicationInfoFields deadline policy', () => {
  it('accepts the 90-day boundary and explains the exact maximum date', async () => {
    const onValid = vi.fn()
    render(
      <DeadlineHarness
        deadline={dayjs().startOf('day').add(90, 'day')}
        onValid={onValid}
      />,
    )

    expect(screen.getByText(/tối đa 90 ngày/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra hạn' }))

    await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1))
  })

  it('rejects day 91 before a request can be submitted', async () => {
    const onValid = vi.fn()
    render(
      <DeadlineHarness
        deadline={dayjs().startOf('day').add(91, 'day')}
        onValid={onValid}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra hạn' }))

    expect(await screen.findByText(
      'Hạn nhận hồ sơ không được quá 90 ngày kể từ hôm nay.',
    )).toBeInTheDocument()
    expect(onValid).not.toHaveBeenCalled()
  })
})
