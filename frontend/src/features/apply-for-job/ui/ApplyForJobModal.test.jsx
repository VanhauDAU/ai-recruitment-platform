import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from '@/shared/lib/toast'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApplyForJobModal from './ApplyForJobModal'
const cvApi = vi.hoisted(() => ({
  getMySavedCvs: vi.fn(),
  importCvFile: vi.fn(),
}))
const applicationApi = vi.hoisted(() => ({ getCandidateApplications: vi.fn(), submitJobApplication: vi.fn() }))

vi.mock('@/entities/cv', async (importOriginal) => ({ ...(await importOriginal()), ...cvApi }))
vi.mock('@/entities/application', () => applicationApi)

describe('ApplyForJobModal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    Object.values(cvApi).forEach((mock) => mock.mockReset())
    applicationApi.submitJobApplication.mockReset()
    applicationApi.getCandidateApplications.mockReset().mockResolvedValue([])
    vi.spyOn(message, 'success').mockImplementation(() => {})
    cvApi.getMySavedCvs.mockResolvedValue([{
      public_id: 'cv_1',
      title: 'CV chính',
      is_default: true,
      cv_type: 'builder',
      latest_version_public_id: 'cvv_2',
      has_unsaved_changes: false,
      completion_score: 85,
      is_complete: true,
      updated_at: '2026-07-17T10:00:00Z',
    }])
  })

  it('submits the saved CV version with workplace and required consent', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    applicationApi.submitJobApplication.mockResolvedValue({ public_id: 'app_1' })

    render(
      <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplyForJobModal
          open
          onClose={onClose}
          jobPublicId="job_1"
          jobTitle="Kỹ sư"
          workplaceGroups={[{ province_id: 3, province_name: 'Bình Dương' }]}
        />
      </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(cvApi.getMySavedCvs).toHaveBeenCalledOnce())
    expect(screen.getByRole('radio', { name: /CV chính/ })).toBeChecked()
    expect(screen.getByRole('link', { name: /Xem/ })).toHaveAttribute('href', '/cvs/cv_1/view')
    const locationSelect = screen.getByRole('combobox', { name: 'Địa điểm làm việc mong muốn' })
    await user.click(locationSelect)
    await user.click(await screen.findByText('Bình Dương', { selector: '.ant-select-item-option-content' }))
    await user.click(screen.getByRole('checkbox', { name: /Tôi đã đọc và đồng ý/ }))
    await user.click(screen.getByRole('button', { name: 'Nộp hồ sơ ứng tuyển' }))

    await waitFor(() => expect(applicationApi.submitJobApplication).toHaveBeenCalledWith({
      jobPublicId: 'job_1',
      cvPublicId: 'cv_1',
      versionPublicId: 'cvv_2',
      coverLetter: '',
      preferredLocationIds: [3],
      allowAiAnalysis: false,
      dataProcessingConsent: true,
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      campaignRef: '',
    }))
    expect(message.success).toHaveBeenCalledWith('Chúc mừng bạn đã ứng tuyển thành công!')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('switches CV locally without reloading the form or CV list', async () => {
    const user = userEvent.setup()
    cvApi.getMySavedCvs.mockResolvedValue([
      {
        public_id: 'cv_1',
        title: 'CV chính',
        is_default: true,
        cv_type: 'builder',
        latest_version_public_id: 'cvv_1',
        has_unsaved_changes: false,
        completion_score: 80,
        is_complete: true,
      },
      {
        public_id: 'cv_2',
        title: 'CV vận hành',
        is_default: false,
        cv_type: 'builder',
        latest_version_public_id: 'cvv_2',
        has_unsaved_changes: true,
        completion_score: 65,
        is_complete: false,
      },
    ])

    render(
      <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplyForJobModal open onClose={vi.fn()} jobPublicId="job_1" jobTitle="Kỹ sư" />
      </MemoryRouter>
      </QueryClientProvider>,
    )

    const secondCv = await screen.findByRole('radio', { name: 'CV vận hành' })
    expect(screen.queryByText('Đã lưu')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Sửa CV/ })).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Sửa CV/ })).toHaveAttribute('href', '/cvs/cv_2/edit')
    await user.type(screen.getByRole('textbox', { name: 'Thư giới thiệu' }), 'Nội dung đang nhập')
    await user.click(secondCv)

    expect(secondCv).toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Thư giới thiệu' })).toHaveValue('Nội dung đang nhập')
    expect(screen.getByText('Có chỉnh sửa chưa lưu')).toBeInTheDocument()
    expect(screen.getByText(/Nhà tuyển dụng sẽ nhận bản đã lưu gần nhất/)).toBeInTheDocument()
    expect(cvApi.getMySavedCvs).toHaveBeenCalledOnce()
  })

  it('sends an uploaded CV as its file with the contact details, and never offers editing', async () => {
    const user = userEvent.setup()
    cvApi.getMySavedCvs.mockResolvedValue([{
      public_id: 'cv_up',
      title: 'CV tải lên.pdf',
      is_default: true,
      cv_type: 'uploaded',
      latest_version_public_id: 'cvv_up',
      has_unsaved_changes: true,
      application_ready: true,
      is_complete: true,
    }])
    applicationApi.submitJobApplication.mockResolvedValue({ public_id: 'app_up' })

    render(
      <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplyForJobModal open onClose={vi.fn()} jobPublicId="job_1" jobTitle="Kỹ sư" candidateName="Lê Văn Hậu" candidateEmail="hau@example.com" />
      </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('radio', { name: /CV tải lên.pdf/ })).toBeChecked()
    expect(screen.queryByRole('link', { name: /Sửa CV/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Có chỉnh sửa chưa lưu')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem' })).toHaveAttribute('href', '/cvs/cv_up/view')
    expect(screen.getByRole('textbox', { name: 'Họ và tên ứng tuyển' })).toHaveValue('Lê Văn Hậu')

    // Thiếu số điện thoại: chưa nộp được dù đã đồng ý điều khoản.
    await user.click(screen.getByRole('checkbox', { name: /Tôi đã đọc và đồng ý/ }))
    expect(screen.getByRole('button', { name: 'Nộp hồ sơ ứng tuyển' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Số điện thoại ứng tuyển' }), '0909000000')
    await user.click(screen.getByRole('button', { name: 'Nộp hồ sơ ứng tuyển' }))

    await waitFor(() => expect(applicationApi.submitJobApplication).toHaveBeenCalledWith(expect.objectContaining({
      cvPublicId: 'cv_up',
      versionPublicId: 'cvv_up',
      contactName: 'Lê Văn Hậu',
      contactEmail: 'hau@example.com',
      contactPhone: '0909000000',
    })))
  })

  it('locks a CV that cannot be submitted and starts on the last CV applied with', async () => {
    const user = userEvent.setup()
    cvApi.getMySavedCvs.mockResolvedValue([
      { public_id: 'cv_blank', title: 'CV thiếu', is_default: true, cv_type: 'builder', latest_version_public_id: 'cvv_b', application_ready: false },
      { public_id: 'cv_ok', title: 'CV đầy đủ', is_default: false, cv_type: 'builder', latest_version_public_id: 'cvv_ok', application_ready: true, is_complete: true },
      { public_id: 'cv_last', title: 'CV đã nộp', is_default: false, cv_type: 'builder', latest_version_public_id: 'cvv_l', application_ready: true, is_complete: true },
    ])
    applicationApi.getCandidateApplications.mockResolvedValue([
      { public_id: 'app_new', cv_public_id: 'cv_last', cover_letter: '' },
      { public_id: 'app_old', cv_public_id: 'cv_ok', cover_letter: 'Thư lần trước' },
    ])

    render(
      <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplyForJobModal open onClose={vi.fn()} jobPublicId="job_1" jobTitle="Kỹ sư" />
      </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('radio', { name: 'CV đã nộp' })).toBeChecked()
    expect(screen.getAllByRole('radio')[0]).toHaveAccessibleName('CV đã nộp')
    expect(screen.getByText('CV ứng tuyển gần nhất')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /CV thiếu/ })).toBeDisabled()
    expect(screen.getByText('Chưa đủ thông tin')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sửa CV/ })).toHaveAttribute('href', '/cvs/cv_blank/edit')

    await user.click(screen.getByRole('button', { name: 'Sử dụng thư giới thiệu gần nhất' }))
    expect(screen.getByRole('textbox', { name: 'Thư giới thiệu' })).toHaveValue('Thư lần trước')
  })

  it('shows the reapplication warning above the form', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplyForJobModal
          open
          onClose={vi.fn()}
          jobPublicId="job_1"
          jobTitle="Kỹ sư"
          isReapplication
          retriesRemaining={2}
        />
      </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Lưu ý')
    expect(screen.getByRole('alert')).toHaveTextContent('Bạn còn 2 lượt ứng tuyển lại')
  })

  it('shows the field name when the API reports a required field', async () => {
    const user = userEvent.setup()
    applicationApi.submitJobApplication.mockRejectedValue({
      response: {
        data: {
          version_public_id: ['This field is required.'],
        },
      },
    })

    render(
      <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplyForJobModal open onClose={vi.fn()} jobPublicId="job_1" jobTitle="Kỹ sư" />
      </MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByRole('radio', { name: /CV chính/ })
    await user.click(screen.getByRole('checkbox', { name: /Tôi đã đọc và đồng ý/ }))
    await user.click(screen.getByRole('button', { name: 'Nộp hồ sơ ứng tuyển' }))

    expect(await screen.findByText('Phiên bản CV: vui lòng nhập thông tin bắt buộc.')).toBeInTheDocument()
  })

  it('opens the upload radio form and uploads only when the application is submitted', async () => {
    const user = userEvent.setup()
    const file = new File(['%PDF-1.7 candidate'], 'candidate.pdf', { type: 'application/pdf' })
    // The checked file is submitted as is: nothing to wait for after the upload.
    cvApi.importCvFile.mockResolvedValue({
      public_id: 'cv_uploaded',
      cv_type: 'uploaded',
      latest_version_public_id: 'cvv_uploaded',
    })
    applicationApi.submitJobApplication.mockResolvedValue({ public_id: 'app_2' })

    render(
      <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplyForJobModal
          open
          onClose={vi.fn()}
          jobPublicId="job_2"
          jobTitle="Nhân viên vận hành"
          candidateName="Lê Văn Hậu"
          candidateEmail="hau@example.com"
          candidatePhone="0909000000"
        />
      </MemoryRouter>
      </QueryClientProvider>,
    )

    const uploadRadio = await screen.findByRole('radio', { name: 'Tải CV từ máy tính' })
    await user.click(uploadRadio)
    expect(screen.getByRole('textbox', { name: 'Họ và tên ứng tuyển' })).toHaveValue('Lê Văn Hậu')
    expect(cvApi.importCvFile).not.toHaveBeenCalled()

    const input = document.querySelector('input[type="file"]')
    await user.upload(input, file)
    expect(screen.getByText('candidate.pdf')).toBeInTheDocument()
    expect(cvApi.importCvFile).not.toHaveBeenCalled()

    await user.click(screen.getByRole('checkbox', { name: /Tôi đã đọc và đồng ý/ }))
    await user.click(screen.getByRole('button', { name: 'Nộp hồ sơ ứng tuyển' }))

    await waitFor(() => expect(cvApi.importCvFile).toHaveBeenCalledWith(
      file,
      'candidate.pdf',
      { onUploadStateChange: expect.any(Function) },
    ))
    await waitFor(() => expect(applicationApi.submitJobApplication).toHaveBeenCalled())
    expect(applicationApi.submitJobApplication).toHaveBeenCalledWith(expect.objectContaining({
      cvPublicId: 'cv_uploaded',
      versionPublicId: 'cvv_uploaded',
      contactName: 'Lê Văn Hậu',
      contactEmail: 'hau@example.com',
      contactPhone: '0909000000',
    }))
  })
})
