import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from '@/shared/lib/toast'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApplyForJobModal from './ApplyForJobModal'
const cvApi = vi.hoisted(() => ({
  getMyCvs: vi.fn(),
  importCvFile: vi.fn(),
}))
const applicationApi = vi.hoisted(() => ({ submitJobApplication: vi.fn() }))

vi.mock('@/entities/cv', () => cvApi)
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
    vi.spyOn(message, 'success').mockImplementation(() => {})
    cvApi.getMyCvs.mockResolvedValue([{
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
      <MemoryRouter>
        <ApplyForJobModal
          open
          onClose={onClose}
          jobPublicId="job_1"
          jobTitle="Kỹ sư"
          workplaceGroups={[{ province_id: 3, province_name: 'Bình Dương' }]}
        />
      </MemoryRouter>,
    )

    await waitFor(() => expect(cvApi.getMyCvs).toHaveBeenCalledOnce())
    expect(screen.getByRole('radio', { name: /CV chính/ })).toBeChecked()
    expect(screen.getByRole('link', { name: /Xem/ })).toHaveClass('opacity-0', 'group-hover:opacity-100')
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
    }))
    expect(message.success).toHaveBeenCalledWith('Đã gửi hồ sơ ứng tuyển.')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('switches CV locally without reloading the form or CV list', async () => {
    const user = userEvent.setup()
    cvApi.getMyCvs.mockResolvedValue([
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
      <MemoryRouter>
        <ApplyForJobModal open onClose={vi.fn()} jobPublicId="job_1" jobTitle="Kỹ sư" />
      </MemoryRouter>,
    )

    const secondCv = await screen.findByRole('radio', { name: 'CV vận hành' })
    expect(screen.queryByText('Đã lưu')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Sửa CV/ })).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Sửa CV/ })).toHaveAttribute('href', '/cvs/cv_2/edit')
    await user.type(screen.getByRole('textbox', { name: 'Thư giới thiệu' }), 'Nội dung đang nhập')
    await user.click(secondCv)

    expect(secondCv).toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Thư giới thiệu' })).toHaveValue('Nội dung đang nhập')
    expect(screen.getByText('Chưa lưu')).toBeInTheDocument()
    expect(cvApi.getMyCvs).toHaveBeenCalledOnce()
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
      <MemoryRouter>
        <ApplyForJobModal open onClose={vi.fn()} jobPublicId="job_1" jobTitle="Kỹ sư" />
      </MemoryRouter>,
    )

    await screen.findByRole('radio', { name: /CV chính/ })
    await user.click(screen.getByRole('checkbox', { name: /Tôi đã đọc và đồng ý/ }))
    await user.click(screen.getByRole('button', { name: 'Nộp hồ sơ ứng tuyển' }))

    expect(await screen.findByText('Phiên bản CV: vui lòng nhập thông tin bắt buộc.')).toBeInTheDocument()
  })

  it('opens the upload radio form and uploads only when the application is submitted', async () => {
    const user = userEvent.setup()
    const file = new File(['%PDF-1.7 candidate'], 'candidate.pdf', { type: 'application/pdf' })
    cvApi.importCvFile.mockResolvedValue({
      public_id: 'cv_uploaded',
      latest_version_public_id: 'cvv_uploaded',
    })
    applicationApi.submitJobApplication.mockResolvedValue({ public_id: 'app_2' })

    render(
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
      </MemoryRouter>,
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

    await waitFor(() => expect(cvApi.importCvFile).toHaveBeenCalledWith(file, 'candidate.pdf'))
    expect(applicationApi.submitJobApplication).toHaveBeenCalledWith(expect.objectContaining({
      cvPublicId: 'cv_uploaded',
      versionPublicId: 'cvv_uploaded',
      contactName: 'Lê Văn Hậu',
      contactEmail: 'hau@example.com',
      contactPhone: '0909000000',
    }))
  })
})
