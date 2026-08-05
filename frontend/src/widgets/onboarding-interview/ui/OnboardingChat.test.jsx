import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OnboardingChat from './OnboardingChat'

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

/** Câu robot nói nằm ở lớp phụ đề đầy đủ, không phải phần chữ đang chạy dần. */
function botSaid(pattern) {
  return [...document.querySelectorAll('.onboarding-chat__sr')]
    .some((node) => pattern.test(node.textContent))
}

function waitForBot(pattern, timeout = 3000) {
  return waitFor(() => expect(botSaid(pattern)).toBe(true), { timeout })
}

function renderChat(props = {}) {
  return render(
    <OnboardingChat
      onFinish={vi.fn()}
      onSaved={vi.fn()}
      onSkip={vi.fn()}
      preference={null}
      user={{ full_name: 'Hậu' }}
      {...props}
    />,
  )
}

async function openChat(user, props) {
  renderChat(props)
  await waitFor(() => expect(mocks.getJobCategories).toHaveBeenCalledOnce())
  await user.click(await screen.findByRole('button', { name: /Bắt đầu thôi/ }))
}

async function answerSpecialization(user) {
  await user.click(await screen.findByRole('button', { name: 'Chọn danh mục vị trí chuyên môn' }))
  await user.click(await screen.findByRole('button', { name: 'Lập trình viên' }))
  await user.click(screen.getByRole('button', { name: 'Xác nhận' }))
  await user.click(screen.getByRole('button', { name: /Gửi/ }))
}

async function answerLocation(user) {
  await user.click(await screen.findByRole('combobox'))
  await user.click(await screen.findByTitle('Đà Nẵng'))
  await user.click(screen.getByRole('button', { name: /Gửi/ }))
}

describe('OnboardingChat', () => {
  beforeEach(() => {
    mocks.getJobCategories.mockReset().mockResolvedValue(CATEGORIES)
    mocks.getProvinces.mockReset().mockResolvedValue(PROVINCES)
    mocks.updateCandidateJobPreferences.mockReset()
  })

  it('chào ứng viên trước, hỏi câu đầu tiên sau khi được bắt chuyện', async () => {
    const user = userEvent.setup()
    renderChat()

    await waitForBot(/Chào Hậu!/)
    expect(screen.queryByText('Câu 1/5')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Bắt đầu thôi/ }))

    await waitForBot(/bạn muốn làm ở lĩnh vực nào/)
    expect(screen.getByText('Câu 1/5')).toBeInTheDocument()
  })

  it('trả lời xong là robot hỏi tiếp, không còn nút tiếp tục hay quay lại', async () => {
    const user = userEvent.setup()
    await openChat(user)
    await answerSpecialization(user)

    await waitForBot(/đi làm trong lĩnh vực này bao lâu/)
    expect(screen.getByText('Lập trình viên')).toBeInTheDocument()

    // Lựa chọn một đáp án: bấm phát gửi luôn, không qua nút trung gian nào.
    await user.click(await screen.findByRole('button', { name: '2 năm' }))

    await waitForBot(/Mức lương mong muốn/)
    expect(screen.getByText('Câu 3/5')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tiếp tục' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quay lại' })).not.toBeInTheDocument()
  })

  it('nhắc ngay trong hội thoại khi ứng viên gửi mà chưa trả lời', async () => {
    const user = userEvent.setup()
    await openChat(user)

    await user.click(await screen.findByRole('button', { name: /Gửi/ }))

    await waitForBot(/ít nhất một vị trí chuyên môn/)
    expect(screen.getByText('Câu 1/5')).toBeInTheDocument()
  })

  it('sửa lại một đáp án cũ ngay tại chỗ thay cho nút quay lại', async () => {
    const user = userEvent.setup()
    await openChat(user)
    await answerSpecialization(user)
    await user.click(await screen.findByRole('button', { name: '2 năm' }))
    await waitForBot(/Mức lương mong muốn/)

    const editButtons = await screen.findAllByRole('button', { name: 'Sửa' })
    await user.click(editButtons[editButtons.length - 1])

    expect(await screen.findByText('Sửa câu trả lời')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '5 năm' }))

    await waitFor(() => expect(screen.queryByText('Sửa câu trả lời')).not.toBeInTheDocument())
    expect(screen.getByText('5 năm')).toBeInTheDocument()
    // Vẫn đứng ở câu đang hỏi dở, không tua lại cuộc trò chuyện.
    expect(screen.getByText('Câu 3/5')).toBeInTheDocument()
  })

  it('đi hết cuộc trò chuyện thì lưu đúng payload của form một trang và chốt lại', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    mocks.updateCandidateJobPreferences.mockResolvedValue({
      job_preferences_configured: true,
      desired_specializations: [{ id: 3, name: 'Lập trình viên' }],
      preferred_provinces: [{ id: 9, name: 'Đà Nẵng' }],
      desired_salary_vnd: 15_000_000,
    })
    await openChat(user, { onSaved })

    await answerSpecialization(user)
    await user.click(await screen.findByRole('button', { name: '2 năm' }))
    await user.click(await screen.findByRole('button', { name: '15 triệu' }))
    await answerLocation(user)

    await waitForBot(/Câu cuối rồi/)
    await user.click(screen.getByRole('checkbox', { name: /gợi ý việc làm dựa trên nhu cầu/ }))
    await user.click(screen.getByRole('button', { name: /Hoàn tất/ }))

    await waitFor(() => expect(mocks.updateCandidateJobPreferences).toHaveBeenCalledOnce())
    expect(mocks.updateCandidateJobPreferences).toHaveBeenCalledWith(expect.objectContaining({
      ai_recommendation_consent: true,
      desired_position_other: '',
      desired_salary_vnd: 15_000_000,
      desired_specialization_ids: [3],
      experience_level: '2',
      preferred_province_ids: [9],
    }))
    expect(onSaved).toHaveBeenCalledOnce()

    await waitForBot(/Xong rồi Hậu!/, 8000)
    expect(screen.getByRole('button', { name: /Xem việc làm dành riêng cho bạn/ })).toBeInTheDocument()
  }, 15_000)

  it('báo lỗi ngay trong hội thoại và mở lại đúng câu bị backend từ chối', async () => {
    const user = userEvent.setup()
    mocks.updateCandidateJobPreferences.mockRejectedValue({
      response: { status: 400, data: { desired_salary_vnd: ['Mức lương phải lớn hơn 0.'] } },
    })
    await openChat(user)

    await answerSpecialization(user)
    await user.click(await screen.findByRole('button', { name: '2 năm' }))
    await user.click(await screen.findByRole('button', { name: '15 triệu' }))
    await answerLocation(user)
    await waitForBot(/Câu cuối rồi/)
    await user.click(screen.getByRole('button', { name: /Hoàn tất/ }))

    await waitForBot(/Mức lương phải lớn hơn 0/, 8000)
    expect(await screen.findByRole('button', { name: /Gửi lại/ })).toBeInTheDocument()
  }, 15_000)
})
