import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { VERIFICATION_CHECK_LABELS } from '@/entities/admin-employer-verification'
import VerificationJourney from './VerificationJourney'

describe('VerificationJourney', () => {
  it('counts only the nine public verification steps and keeps details compact by default', async () => {
    const user = userEvent.setup()
    const checks = Object.fromEntries(
      Object.keys(VERIFICATION_CHECK_LABELS).map((key) => [key, true]),
    )

    render(
      <VerificationJourney
        checks={{
          ...checks,
          candidate_dpa_submitted: true,
          case_approved: true,
        }}
      />,
    )

    const progress = screen.getByRole('progressbar', { name: 'Tiến độ 9 bước xác thực' })

    expect(progress).toHaveAttribute('aria-valuenow', '9')
    expect(progress).toHaveAttribute('aria-valuemax', '9')
    expect(screen.getByText('Hồ sơ đã hoàn tất toàn bộ điều kiện')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Xem 9 bước' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(9)
    expect(screen.queryByText('11/9')).not.toBeInTheDocument()
  })

  it('highlights the first missing condition as the next step', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <VerificationJourney
        checks={{
          email_verified: true,
          registration_completed: true,
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Xem 9 bước' }))
    const currentStep = container.querySelector('[aria-current="step"]')

    expect(currentStep).not.toBeNull()
    expect(within(currentStep).getByText('Đã khai báo nhu cầu tuyển dụng')).toBeInTheDocument()
    expect(within(currentStep).getByText('Cần xử lý tiếp')).toBeInTheDocument()
    expect(screen.getByText('Còn 7 bước')).toBeInTheDocument()
  })
})
