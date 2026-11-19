import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import JobVisibilityHoldAlert from './JobVisibilityHoldAlert'

const CHANGE_REQUEST = {
  kind: 'moderation',
  code: 'changes_requested',
  reason_label: 'Nội dung chưa đầy đủ',
  request_note: 'Bổ sung mức lương.',
  editable: true,
  resubmitted_at: null,
}

describe('JobVisibilityHoldAlert', () => {
  it('shows what to fix and lets the owner resubmit', async () => {
    const onResubmit = vi.fn()
    render(<JobVisibilityHoldAlert hold={CHANGE_REQUEST} onResubmit={onResubmit} />)

    expect(screen.getByText('Bổ sung mức lương.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Gửi duyệt lại' }))
    expect(onResubmit).toHaveBeenCalledTimes(1)
  })

  it('waits for the review once the job was resubmitted', () => {
    render(
      <JobVisibilityHoldAlert
        hold={{ ...CHANGE_REQUEST, editable: false, resubmitted_at: '2026-11-16T03:00:00Z' }}
        onResubmit={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Gửi duyệt lại' })).not.toBeInTheDocument()
    expect(screen.getByText(/Bạn đã gửi duyệt lại lúc/)).toBeInTheDocument()
  })
})
