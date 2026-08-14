import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobPreferencesForm from './JobPreferencesForm'

const mocks = vi.hoisted(() => ({
  getJobCategories: vi.fn(),
  getProvinces: vi.fn(),
  getSkills: vi.fn(),
  updateCandidateJobPreferences: vi.fn(),
}))

vi.mock('@/entities/candidate-preferences', () => ({
  updateCandidateJobPreferences: mocks.updateCandidateJobPreferences,
}))
vi.mock('@/entities/job', () => ({
  getJobCategories: mocks.getJobCategories,
  getSkills: mocks.getSkills,
}))
vi.mock('@/entities/location', () => ({
  getProvinces: mocks.getProvinces,
}))

const VALID_PREFERENCE = {
  desired_position_others: ['Kỹ sư dữ liệu'],
  desired_salary_vnd: 18_000_000,
  desired_specializations: [],
  experience_level: '2',
  preferred_provinces: [{ id: 9, name: 'Đà Nẵng' }],
  recruiter_visibility_consent: false,
  willing_to_relocate: false,
}

describe('JobPreferencesForm', () => {
  beforeEach(() => {
    mocks.getJobCategories.mockReset().mockResolvedValue([])
    mocks.getProvinces.mockReset().mockResolvedValue([])
    mocks.getSkills.mockReset().mockResolvedValue([])
    mocks.updateCandidateJobPreferences.mockReset().mockResolvedValue({ job_preferences_configured: true })
  })

  it('describes recruiter visibility as profile access, not unrelated email updates', async () => {
    render(
      <JobPreferencesForm
        preference={{
          desired_specializations: [],
          preferred_provinces: [],
          recruiter_visibility_consent: false,
        }}
        profile={{ gender: 'unspecified' }}
        variant="settings"
      />,
    )

    await waitFor(() => expect(mocks.getJobCategories).toHaveBeenCalledOnce())
    expect(screen.getByRole('checkbox', {
      name: 'Đồng ý cho phép nhà tuyển dụng tìm thấy và xem thông tin hồ sơ/CV của tôi.',
    })).toBeInTheDocument()
    expect(screen.queryByText(/nhận thông tin liên quan đến việc làm và sự kiện/i)).not.toBeInTheDocument()
  })

  it('loads skills and saves a custom-only position with canonical and legacy fields', async () => {
    const user = userEvent.setup()
    mocks.getSkills.mockResolvedValue([
      { id: 4, name: 'Python' },
      { id: 8, name: 'Django' },
    ])
    render(
      <JobPreferencesForm
        preference={{
          ...VALID_PREFERENCE,
          preferred_skills: [{ id: 4, name: 'Python' }, { id: 8, name: 'Django' }],
        }}
        profile={{ gender: 'unspecified' }}
        variant="settings"
      />,
    )

    await waitFor(() => expect(mocks.getSkills).toHaveBeenCalledOnce())
    const customPositionItem = screen
      .getByText('Nhập tối đa 5 vị trí chuyên môn không có trong danh mục')
      .closest('.ant-form-item')
    const skillItem = screen.getByText('Kỹ năng').closest('.ant-form-item')
    expect(customPositionItem?.nextElementSibling).toBe(skillItem)
    await user.click(await screen.findByRole('button', { name: 'Hoàn thành' }))

    await waitFor(() => expect(mocks.updateCandidateJobPreferences).toHaveBeenCalledOnce())
    expect(mocks.updateCandidateJobPreferences).toHaveBeenCalledWith(expect.objectContaining({
      desired_position_other: 'Kỹ sư dữ liệu',
      desired_position_others: ['Kỹ sư dữ liệu'],
      desired_specialization_ids: [],
      preferred_skill_ids: [4, 8],
    }))
  })

  it('rejects more than 20 saved skills', async () => {
    const user = userEvent.setup()
    const skills = Array.from({ length: 21 }, (_, index) => ({ id: index + 1, name: `Kỹ năng ${index + 1}` }))
    mocks.getSkills.mockResolvedValue(skills)
    render(
      <JobPreferencesForm
        preference={{ ...VALID_PREFERENCE, preferred_skills: skills }}
        profile={{ gender: 'unspecified' }}
        variant="settings"
      />,
    )

    await waitFor(() => expect(mocks.getSkills).toHaveBeenCalledOnce())
    await user.click(await screen.findByRole('button', { name: 'Hoàn thành' }))

    expect(await screen.findByText('Chỉ được chọn tối đa 20 kỹ năng.')).toBeInTheDocument()
    expect(mocks.updateCandidateJobPreferences).not.toHaveBeenCalled()
  })
})
