import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobPreferencesForm from './JobPreferencesForm'

const mocks = vi.hoisted(() => ({
  getJobCategories: vi.fn(),
  getProvinces: vi.fn(),
  updateCandidateJobPreferences: vi.fn(),
}))

vi.mock('@/entities/candidate-preferences', () => ({
  updateCandidateJobPreferences: mocks.updateCandidateJobPreferences,
}))
vi.mock('@/entities/job', () => ({
  getJobCategories: mocks.getJobCategories,
}))
vi.mock('@/entities/location', () => ({
  getProvinces: mocks.getProvinces,
}))

describe('JobPreferencesForm consent copy', () => {
  beforeEach(() => {
    mocks.getJobCategories.mockResolvedValue([])
    mocks.getProvinces.mockResolvedValue([])
    mocks.updateCandidateJobPreferences.mockReset()
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
})
