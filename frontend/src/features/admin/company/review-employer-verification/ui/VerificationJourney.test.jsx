import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { VERIFICATION_CHECK_LABELS } from '@/entities/company/admin-employer-verification'
import VerificationJourney from './VerificationJourney'

describe('VerificationJourney', () => {
  it('counts only the eight public verification steps and keeps details compact by default', async () => {
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

    const progress = screen.getByRole('progressbar', { name: 'Tiến độ 8 bước xác thực' })

    expect(progress).toHaveAttribute('aria-valuenow', '8')
    expect(progress).toHaveAttribute('aria-valuemax', '8')
    expect(screen.getByText('Hồ sơ đã hoàn tất toàn bộ điều kiện')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Xem 8 bước' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
    expect(screen.queryByText('10/8')).not.toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: 'Xem 8 bước' }))
    const currentStep = container.querySelector('[aria-current="step"]')

    expect(currentStep).not.toBeNull()
    expect(within(currentStep).getByText('Số điện thoại đã xác minh')).toBeInTheDocument()
    expect(within(currentStep).getByText('Cần xử lý tiếp')).toBeInTheDocument()
    expect(screen.getByText('Còn 6 bước')).toBeInTheDocument()
  })
})
