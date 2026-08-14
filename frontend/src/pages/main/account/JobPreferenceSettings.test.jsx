import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jobKeys } from '@/entities/job'
import JobPreferenceSettings from './JobPreferenceSettings'

const mocks = vi.hoisted(() => ({
  getCandidateJobPreferences: vi.fn(),
  getCandidateProfile: vi.fn(),
  setCurrentUser: vi.fn(),
  user: { public_id: 'candidate_1', job_preferences_configured: true },
}))

vi.mock('@/entities/candidate-preferences', () => ({
  getCandidateJobPreferences: mocks.getCandidateJobPreferences,
}))
vi.mock('@/entities/candidate-profile', () => ({
  getCandidateProfile: mocks.getCandidateProfile,
  updateCandidateProfile: vi.fn(),
}))
vi.mock('@/entities/session', () => ({
  useSession: () => ({
    user: mocks.user,
    setCurrentUser: mocks.setCurrentUser,
  }),
}))
vi.mock('@/entities/site-settings', () => ({
  BrandLogo: () => <span>ProCV</span>,
}))
vi.mock('@/features/configure-job-preferences', () => ({
  JobPreferencesForm: ({ onSaved }) => (
    <button
      type="button"
      onClick={() => onSaved({ job_preferences_configured: true })}
    >
      Lưu preference giả lập
    </button>
  ),
}))

describe('JobPreferenceSettings', () => {
  beforeEach(() => {
    mocks.getCandidateJobPreferences.mockReset()
    mocks.getCandidateProfile.mockReset()
    mocks.getCandidateJobPreferences.mockResolvedValue({})
    mocks.getCandidateProfile.mockResolvedValue({ gender: 'unspecified' })
    mocks.setCurrentUser.mockReset()
  })

  it('removes every cached recommendation page after preference or consent changes', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient()
    const removeQueries = vi.spyOn(queryClient, 'removeQueries')
    queryClient.setQueryData(jobKeys.candidateRecommendations({ page: 1 }), {
      status: 'ready',
    })
    queryClient.setQueryData(jobKeys.inlineRecommendations({
      excluded: 'job_1',
      page: 1,
      ranking_seed: 'seed',
    }), { status: 'ready' })

    render(
      <QueryClientProvider client={queryClient}>
        <JobPreferenceSettings />
      </QueryClientProvider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Lưu preference giả lập' }))

    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: jobKeys.candidateRecommendationsRoot,
    })
    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: jobKeys.inlineRecommendationsRoot,
    })
    await waitFor(() => {
      expect(queryClient.getQueryData(
        jobKeys.candidateRecommendations({ page: 1 }),
      )).toBeUndefined()
      expect(queryClient.getQueryData(jobKeys.inlineRecommendations({
        excluded: 'job_1',
        page: 1,
        ranking_seed: 'seed',
      }))).toBeUndefined()
    })
  })

  it('blocks the form on load failure and lets the candidate retry safely', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient()
    mocks.getCandidateJobPreferences
      .mockRejectedValueOnce({ response: { status: 503, data: {} } })
      .mockResolvedValueOnce({})

    render(
      <QueryClientProvider client={queryClient}>
        <JobPreferenceSettings />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Chưa tải được cài đặt gợi ý việc làm')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu preference giả lập' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByRole('button', { name: 'Lưu preference giả lập' })).toBeInTheDocument()
    expect(mocks.getCandidateJobPreferences).toHaveBeenCalledTimes(2)
  })
})
