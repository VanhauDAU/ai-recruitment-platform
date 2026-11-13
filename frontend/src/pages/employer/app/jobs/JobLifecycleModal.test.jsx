import { fireEvent, render, screen } from '@testing-library/react'
import dayjs from 'dayjs'
import { describe, expect, it, vi } from 'vitest'
import JobLifecycleModal from './JobLifecycleModal'

const commitment = {
  version: '2026-11',
  text: 'Tôi cam kết nội dung đúng sự thật và chịu trách nhiệm về tin đã đăng.',
}

function renderModal(props) {
  const onCommitmentChange = vi.fn()
  render(
    <JobLifecycleModal
      commitment={commitment}
      commitmentAccepted={false}
      deadline={dayjs().add(7, 'day')}
      earliestDeadline={dayjs()}
      latestDeadline={dayjs().add(90, 'day')}
      onCancel={vi.fn()}
      onCommitmentChange={onCommitmentChange}
      onDeadlineChange={vi.fn()}
      onSubmit={vi.fn()}
      {...props}
    />,
  )
  return { onCommitmentChange }
}

describe('JobLifecycleModal', () => {
  it('asks for the publication commitment when reopening a job', () => {
    const { onCommitmentChange } = renderModal({ action: 'reopen' })

    fireEvent.click(screen.getByRole('checkbox', { name: commitment.text }))

    expect(onCommitmentChange).toHaveBeenCalledWith(true)
  })

  it('does not ask for the commitment when extending a job that is already public', () => {
    renderModal({ action: 'extend' })

    expect(screen.getByText('Gia hạn tin tuyển dụng')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('says so when the commitment text could not be loaded', () => {
    renderModal({ action: 'reopen', commitment: undefined })

    expect(screen.getByText(/Chưa tải được nội dung cam kết đăng tin/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
