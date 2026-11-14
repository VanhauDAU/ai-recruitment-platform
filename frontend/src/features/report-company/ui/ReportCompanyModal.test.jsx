import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportCompanyModal from './ReportCompanyModal'

const { submitCompanyReport, toast } = vi.hoisted(() => ({
  submitCompanyReport: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/entities/company-report', () => ({
  COMPANY_REPORT_REASON_OPTIONS: [
    { value: 'wrong_info', label: 'Thông tin công ty sai sự thật' },
    { value: 'other', label: 'Lý do khác' },
  ],
  submitCompanyReport,
}))
vi.mock('@/shared/lib/toast', () => ({ message: toast }))

const SECTIONS = [
  { key: 'about', title: 'Giới thiệu công ty' },
  { key: 'general_info', title: 'Thông tin chung' },
]

function renderModal(props = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <App>
        <ReportCompanyModal
          company={{ public_id: 'co_ab12', name: 'FPT Software' }}
          sections={SECTIONS}
          onClose={onClose}
          open
          {...props}
        />
      </App>
    </QueryClientProvider>,
  )
  return { onClose }
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
const describeIssue = (value) => fireEvent.change(screen.getByLabelText('Mô tả chi tiết'), { target: { value } })

describe('ReportCompanyModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    submitCompanyReport.mockResolvedValue({ public_id: 'crp_1', status: 'pending' })
  })

  it('submits the reason, the related section and the trimmed detail', async () => {
    const { onClose } = renderModal()

    expect(screen.getByText('FPT Software')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Thông tin công ty sai sự thật' }))
    fireEvent.mouseDown(screen.getByLabelText('Phần thông tin liên quan'))
    fireEvent.click(screen.getByText('Thông tin chung'))
    describeIssue('  Quy mô công ty không đúng.  ')
    submit()

    await waitFor(() => expect(submitCompanyReport).toHaveBeenCalledWith('co_ab12', {
      reason: 'wrong_info',
      section_key: 'general_info',
      detail: 'Quy mô công ty không đúng.',
    }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith('Đã gửi báo cáo. Quản trị viên sẽ xem xét trước khi kết luận.')
  })

  it('requires a reason and, for "other", at least ten characters of detail', async () => {
    renderModal({ sections: [] })

    expect(screen.queryByLabelText('Phần thông tin liên quan')).not.toBeInTheDocument()
    submit()
    expect(await screen.findByText('Chọn lý do báo cáo.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Lý do khác' }))
    describeIssue('  quá ngắn ')
    submit()
    expect(await screen.findByText('Mô tả ít nhất 10 ký tự khi chọn “Lý do khác”.')).toBeInTheDocument()
    expect(submitCompanyReport).not.toHaveBeenCalled()

    describeIssue('Trang dùng logo của doanh nghiệp khác.')
    submit()
    await waitFor(() => expect(submitCompanyReport).toHaveBeenCalledWith('co_ab12', {
      reason: 'other',
      section_key: '',
      detail: 'Trang dùng logo của doanh nghiệp khác.',
    }))
    expect(screen.getByLabelText('Mô tả chi tiết')).toHaveAttribute('maxlength', '2000')
  })

  it('keeps the form open and explains a duplicate pending report', async () => {
    submitCompanyReport.mockRejectedValue({
      response: { status: 400, data: { detail: 'Bạn đã có một báo cáo đang chờ xử lý cho công ty này.' } },
    })
    const { onClose } = renderModal()

    fireEvent.click(screen.getByRole('radio', { name: 'Thông tin công ty sai sự thật' }))
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn đã có một báo cáo đang chờ xử lý cho công ty này.')
    expect(onClose).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('maps field errors to their inputs and reports other failures as a toast', async () => {
    submitCompanyReport.mockRejectedValueOnce({
      response: { status: 400, data: { section_key: ['Phần này không thuộc trang công ty.'], detail: ['Mô tả quá dài.'] } },
    })
    renderModal()

    fireEvent.click(screen.getByRole('radio', { name: 'Thông tin công ty sai sự thật' }))
    submit()
    expect(await screen.findByText('Phần này không thuộc trang công ty.')).toBeInTheDocument()
    expect(screen.getByText('Mô tả quá dài.')).toBeInTheDocument()

    submitCompanyReport.mockRejectedValueOnce({ response: { status: 500 } })
    submit()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Hệ thống đang gặp lỗi. Vui lòng thử lại sau ít phút.'))
  })
})
