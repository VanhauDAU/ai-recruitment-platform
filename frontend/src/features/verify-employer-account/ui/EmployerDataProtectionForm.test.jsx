import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import EmployerDataProtectionForm from './EmployerDataProtectionForm'

const {
  acceptEmployerDpa,
  getEmployerCompanyDocuments,
  getEmployerProfile,
  uploadEmployerDataProcessingAgreement,
} = vi.hoisted(() => ({
  acceptEmployerDpa: vi.fn(),
  getEmployerCompanyDocuments: vi.fn(),
  getEmployerProfile: vi.fn(),
  uploadEmployerDataProcessingAgreement: vi.fn(),
}))
const { message } = vi.hoisted(() => ({ message: { error: vi.fn(), success: vi.fn() } }))

vi.mock('@/entities/employer-profile', () => ({
  acceptEmployerDpa,
  getEmployerCompanyDocuments,
  getEmployerProfile,
  uploadEmployerDataProcessingAgreement,
}))
vi.mock('@/entities/site-settings', () => ({ useSiteSettings: () => ({ siteName: 'TopCV' }) }))
vi.mock('@/shared/lib/toast', () => ({ message }))

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <App>
      <QueryClientProvider client={client}><EmployerDataProtectionForm /></QueryClientProvider>
    </App>,
  )
}

describe('EmployerDataProtectionForm', () => {
  it('keeps both legal actions available before company information is updated', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: false, candidate_dpa_submitted: false, dpa_accepted: false } })
    getEmployerCompanyDocuments.mockResolvedValue([])
    uploadEmployerDataProcessingAgreement.mockResolvedValue({ id: 1 })
    acceptEmployerDpa.mockResolvedValue({})
    const user = userEvent.setup()
    const { container } = renderForm()

    expect(await screen.findByRole('heading', { name: /giữa Ứng viên - Nhà tuyển dụng/i })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Tại đây' })).toHaveClass('!text-emerald-600')
    expect(screen.getByText('Tải mẫu văn bản').closest('a')).toHaveAttribute('href', '/documents/topcv-mau-van-ban-thong-bao-dong-y-xu-ly-dlcn.docx')
    expect(screen.getByRole('link', { name: /Tải mẫu văn bản/ })).toHaveClass('!text-emerald-600')
    expect(screen.getByRole('link', { name: /Xem nội dung đầy đủ của văn bản/ })).toHaveClass('!text-emerald-600')
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()

    const input = container.querySelector('input[type="file"]')
    await user.upload(input, new File(['candidate agreement'], 'thoa-thuan.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
    await user.click(screen.getByRole('checkbox', { name: /Tôi cam đoan văn bản này/i }))
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(uploadEmployerDataProcessingAgreement).toHaveBeenCalledTimes(1))
    expect(message.success).toHaveBeenCalledWith('Thông báo', {
      description: 'Cập nhật thành công. TopCV đã nhận được giấy tờ của bạn và tiến hành xử lý sớm.',
    })

    await user.click(screen.getByRole('checkbox', { name: /Xác nhận đồng ý với các điều khoản/i }))
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(acceptEmployerDpa).toHaveBeenCalledTimes(1))
  })

  it('opens a public DOCX in Google Viewer and only opens replacement controls on edit', async () => {
    getEmployerProfile.mockResolvedValue({
      dpa_accepted_at: '2026-07-19T15:28:37Z',
      onboarding: { company_linked: false, candidate_dpa_submitted: true, dpa_accepted: true },
    })
    getEmployerCompanyDocuments.mockResolvedValue([{
      id: 1,
      doc_type: 'data_processing_agreement',
      file_name: 'thoa-thuan.docx',
      file_url: 'https://files.example.com/thoa-thuan.docx',
      status: 'pending',
    }])
    const user = userEvent.setup()
    const { container } = renderForm()

    expect(await screen.findByText('Hệ thống đang xử lý')).toBeVisible()
    const documentLink = screen.getByRole('link', { name: 'Thỏa thuận xử lý DLCN' })
    expect(documentLink).toHaveAttribute('href', 'https://docs.google.com/gview?url=https%3A%2F%2Ffiles.example.com%2Fthoa-thuan.docx&embedded=true')
    expect(documentLink).toHaveClass('hover:!text-[var(--brand-primary)]')
    expect(screen.getByText('Văn bản mẫu')).toBeVisible()
    expect(screen.getByRole('link', { name: /Tải mẫu văn bản/ })).toBeVisible()
    expect(screen.queryByText('Chờ duyệt')).not.toBeInTheDocument()
    expect(screen.getByText('Bạn đã xác nhận vào 22:28:37 19/07/2026.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa văn bản' }))
    expect(screen.getByText('Chọn hoặc kéo file vào đây')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeVisible()
    expect(screen.getByRole('link', { name: /Tệp hiện tại: Thỏa thuận xử lý DLCN/ })).toHaveAttribute('href', 'https://docs.google.com/gview?url=https%3A%2F%2Ffiles.example.com%2Fthoa-thuan.docx&embedded=true')
    await user.upload(container.querySelector('input[type="file"]'), new File(['replacement'], 'thoa-thuan-moi.pdf', { type: 'application/pdf' }))
    expect(screen.getByText('Tệp mới: thoa-thuan-moi.pdf')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(screen.queryByText('Chọn hoặc kéo file vào đây')).not.toBeInTheDocument()
  })
})
