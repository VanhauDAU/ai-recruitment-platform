import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportJobModal from './ReportJobModal'

const { submitJobReport } = vi.hoisted(() => ({
  submitJobReport: vi.fn(),
}))

vi.mock('@/entities/job-report', () => ({
  JOB_REPORT_REASON_OPTIONS: [
    { value: 'scam', label: 'Lừa đảo, thu phí ứng viên' },
    { value: 'other', label: 'Lý do khác' },
  ],
  submitJobReport,
}))

vi.mock('@/shared/lib/toast', () => ({
  message: { error: vi.fn(), success: vi.fn() },
}))

function renderModal(props = {}) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <App>
        <ReportJobModal
          jobPublicId="job_1"
          jobTitle="Backend Engineer"
          onClose={vi.fn()}
          open
          {...props}
        />
      </App>
    </QueryClientProvider>,
  )
}

describe('ReportJobModal', () => {
  beforeEach(() => {
    submitJobReport.mockReset()
    submitJobReport.mockResolvedValue({ public_id: 'jrep_1', status: 'pending' })
  })

  it('submits a selected reason and trimmed detail', async () => {
    const onClose = vi.fn()
    renderModal({ onClose })

    await userEvent.click(screen.getByLabelText('Lý do báo cáo'))
    await userEvent.click(screen.getByText('Lừa đảo, thu phí ứng viên'))
    await userEvent.type(screen.getByLabelText('Mô tả chi tiết'), '  Yêu cầu đóng phí.  ')
    await userEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))

    await waitFor(() => expect(submitJobReport).toHaveBeenCalledWith('job_1', {
      reason: 'scam',
      detail: 'Yêu cầu đóng phí.',
    }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('requires detail when the reason is other', async () => {
    renderModal()

    await userEvent.click(screen.getByLabelText('Lý do báo cáo'))
    await userEvent.click(screen.getByText('Lý do khác'))
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))

    expect(await screen.findByText('Mô tả cụ thể khi chọn “Lý do khác”.')).toBeInTheDocument()
    expect(submitJobReport).not.toHaveBeenCalled()
  })
})
