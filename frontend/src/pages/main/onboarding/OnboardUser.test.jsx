import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jobKeys } from '@/entities/job'
import OnboardUser from './OnboardUser'

const mocks = vi.hoisted(() => ({
  getCandidateJobPreferences: vi.fn(),
  setCurrentUser: vi.fn(),
}))

vi.mock('@/entities/candidate-preferences', () => ({
  getCandidateJobPreferences: mocks.getCandidateJobPreferences,
}))

vi.mock('@/entities/session', () => ({
  useSession: () => ({
    setCurrentUser: mocks.setCurrentUser,
    user: { public_id: 'candidate_1', job_preferences_configured: false },
  }),
}))

vi.mock('@/widgets/onboarding-interview', () => ({
  OnboardingChat: ({ onSaved }) => (
    <button
      type="button"
      onClick={() => onSaved({
        desired_position_others: ['Kỹ sư dữ liệu'],
        desired_specializations: [],
        job_preferences_configured: true,
        preferred_provinces: [],
      })}
    >
      Lưu onboarding giả lập
    </button>
  ),
}))

describe('OnboardUser', () => {
  beforeEach(() => {
    mocks.getCandidateJobPreferences.mockReset().mockResolvedValue({})
    mocks.setCurrentUser.mockReset()
  })

  it('removes matching and inline recommendation caches after onboarding save', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient()
    const matchingKey = jobKeys.candidateRecommendations({ page: 1 })
    const inlineKey = jobKeys.inlineRecommendations({
      excluded: 'job_1',
      page: 1,
      ranking_seed: 'seed',
    })
    queryClient.setQueryData(matchingKey, { status: 'ready' })
    queryClient.setQueryData(inlineKey, { status: 'ready' })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OnboardUser />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Lưu onboarding giả lập' }))

    await waitFor(() => {
      expect(queryClient.getQueryData(matchingKey)).toBeUndefined()
      expect(queryClient.getQueryData(inlineKey)).toBeUndefined()
    })
    expect(mocks.setCurrentUser).toHaveBeenCalledWith(expect.objectContaining({
      job_preferences_configured: true,
    }))
  })
})
