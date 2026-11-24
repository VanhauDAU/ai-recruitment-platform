import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FollowCompanyPrompt from './FollowCompanyPrompt'

const { api, audience } = vi.hoisted(() => ({
  api: { getCompanyFollow: vi.fn(), followCompany: vi.fn(), unfollowCompany: vi.fn() },
  audience: { current: 'candidate' },
}))

vi.mock('../api/follow-company.api', () => api)
vi.mock('@/entities/account/session', () => ({ useCandidateAudience: () => audience.current }))
vi.mock('@/shared/lib/toast', () => ({ message: { error: vi.fn() } }))

const COMPANY = { public_id: 'co_ab12', name: 'Techcombank', logo_url: '' }
const NOT_FOLLOWING = { following: false, notify_new_jobs: false, follower_count: 12 }
const FOLLOWING = { following: true, notify_new_jobs: true, follower_count: 13 }

function renderPrompt(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onRequireLogin = vi.fn()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <FollowCompanyPrompt company={COMPANY} visible onRequireLogin={onRequireLogin} {...props} />
    </QueryClientProvider>,
  )
  return { ...view, onRequireLogin }
}

describe('FollowCompanyPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    audience.current = 'candidate'
    api.getCompanyFollow.mockResolvedValue(NOT_FOLLOWING)
    api.followCompany.mockResolvedValue(FOLLOWING)
  })

  it('follows the company and then hides itself', async () => {
    const user = userEvent.setup()
    renderPrompt()

    const prompt = await screen.findByRole('complementary', { name: 'Theo dõi công ty' })
    expect(prompt).toHaveTextContent('Techcombank')
    await user.click(screen.getByRole('button', { name: 'Theo dõi ngay' }))

    await waitFor(() => expect(api.followCompany).toHaveBeenCalledWith('co_ab12', {}))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('asks a guest to sign in before following', async () => {
    const user = userEvent.setup()
    audience.current = 'guest'
    const { onRequireLogin } = renderPrompt()

    await user.click(screen.getByRole('button', { name: 'Theo dõi ngay' }))
    expect(onRequireLogin).toHaveBeenCalledOnce()
    act(() => onRequireLogin.mock.calls[0][0]())
    await waitFor(() => expect(api.followCompany).toHaveBeenCalledWith('co_ab12', {}))
  })

  it('stays hidden until visible and after being dismissed', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPrompt({ visible: false })
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    unmount()

    renderPrompt()
    await user.click(await screen.findByRole('button', { name: 'Đóng lời mời theo dõi' }))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('does not show for a candidate who already follows or for employers', async () => {
    api.getCompanyFollow.mockResolvedValue(FOLLOWING)
    const { unmount } = renderPrompt()
    await waitFor(() => expect(api.getCompanyFollow).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('complementary')).not.toBeInTheDocument())
    unmount()

    audience.current = null
    const { container } = renderPrompt()
    expect(container).toBeEmptyDOMElement()
  })
})
