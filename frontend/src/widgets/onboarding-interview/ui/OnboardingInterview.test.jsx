import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OnboardingInterview from './OnboardingInterview'

const mocks = vi.hoisted(() => ({
  getJobCategories: vi.fn(),
  getProvinces: vi.fn(),
  updateCandidateJobPreferences: vi.fn(),
}))

vi.mock('@/entities/candidate-preferences', () => ({
  updateCandidateJobPreferences: mocks.updateCandidateJobPreferences,
}))
vi.mock('@/entities/job', () => ({ getJobCategories: mocks.getJobCategories }))
vi.mock('@/entities/location', () => ({ getProvinces: mocks.getProvinces }))

const CATEGORIES = [
  { id: 1, name: 'Công nghệ thông tin', parent: null, category_type: 'group' },
  { id: 2, name: 'Phần mềm', parent: 1, category_type: 'job' },
  { id: 3, name: 'Lập trình viên', parent: 2, category_type: 'specialization' },
]
const PROVINCES = [{ id: 9, name: 'Đà Nẵng' }]

function mascot() {
  return document.querySelector('.procv-mascot')
}

async function pickSpecialization(user) {
  await user.click(screen.getByRole('button', { name: 'Chọn danh mục vị trí chuyên môn' }))
  await user.click(await screen.findByRole('button', { name: 'Lập trình viên' }))
  await user.click(screen.getByRole('button', { name: 'Xác nhận' }))
}

describe('OnboardingInterview', () => {
  beforeEach(() => {
    mocks.getJobCategories.mockReset().mockResolvedValue(CATEGORIES)
    mocks.getProvinces.mockReset().mockResolvedValue(PROVINCES)
    mocks.updateCandidateJobPreferences.mockReset()
  })

  it('mở đầu bằng câu hỏi có tên ứng viên và robot cầm bảng ghi chép', async () => {
    render(<OnboardingInterview onSaved={vi.fn()} onSkip={vi.fn()} preference={null} user={{ full_name: 'Hậu' }} />)

    await waitFor(() => expect(mocks.getJobCategories).toHaveBeenCalledOnce())
    expect(screen.getByText(/Chào Hậu!/)).toBeInTheDocument()
    expect(screen.getByText('Câu 1/5')).toBeInTheDocument()
    expect(mascot()).toHaveAttribute('data-pose', 'checklist')
  })

  it('không cho qua bước khi chưa trả lời và robot chuyển sang cảm xúc lỗi', async () => {
    const user = userEvent.setup()
    render(<OnboardingInterview onSaved={vi.fn()} onSkip={vi.fn()} preference={null} user={null} />)

    await waitFor(() => expect(mocks.getJobCategories).toHaveBeenCalledOnce())
    await user.click(screen.getByRole('button', { name: /Tiếp tục/ }))

    expect(screen.getByText('Câu 1/5')).toBeInTheDocument()
    expect(screen.getByText(/Vui lòng chọn ít nhất một vị trí chuyên môn/)).toBeInTheDocument()
    expect(mascot()).toHaveAttribute('data-emotion', 'error')
  })

  it('trả lời đủ năm câu thì lưu đúng payload của form một trang', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    mocks.updateCandidateJobPreferences.mockResolvedValue({ job_preferences_configured: true })
    render(<OnboardingInterview onSaved={onSaved} onSkip={vi.fn()} preference={null} user={null} />)

    await waitFor(() => expect(mocks.getJobCategories).toHaveBeenCalledOnce())
    await pickSpecialization(user)
    await user.click(screen.getByRole('button', { name: /Tiếp tục/ }))

    await user.click(screen.getByRole('button', { name: '2 năm' }))
    await user.click(screen.getByRole('button', { name: /Tiếp tục/ }))

    await user.click(screen.getByRole('button', { name: '15 triệu' }))
    await user.click(screen.getByRole('button', { name: /Tiếp tục/ }))

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByTitle('Đà Nẵng'))
    await user.click(screen.getByRole('button', { name: /Tiếp tục/ }))

    expect(screen.getByText('Câu 5/5')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Hoàn thành/ }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ job_preferences_configured: true }))
    expect(mocks.updateCandidateJobPreferences).toHaveBeenCalledWith(expect.objectContaining({
      desired_position_other: '',
      desired_salary_vnd: 15_000_000,
      desired_specialization_ids: [3],
      experience_level: '2',
      preferred_province_ids: [9],
    }))
  })

  it('quay lại bước trước vẫn giữ đáp án', async () => {
    const user = userEvent.setup()
    render(<OnboardingInterview onSaved={vi.fn()} onSkip={vi.fn()} preference={null} user={null} />)

    await waitFor(() => expect(mocks.getJobCategories).toHaveBeenCalledOnce())
    await pickSpecialization(user)
    await user.click(screen.getByRole('button', { name: /Tiếp tục/ }))
    await user.click(screen.getByRole('button', { name: /Quay lại/ }))

    expect(screen.getByText('Câu 1/5')).toBeInTheDocument()
    expect(screen.getByText('Lập trình viên')).toBeInTheDocument()
  })
})
