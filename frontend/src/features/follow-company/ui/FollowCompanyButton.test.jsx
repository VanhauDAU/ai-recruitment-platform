import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FollowCompanyButton from './FollowCompanyButton'

const { api, audience } = vi.hoisted(() => ({
  api: { getCompanyFollow: vi.fn(), followCompany: vi.fn(), unfollowCompany: vi.fn() },
  audience: { current: 'candidate' },
}))

vi.mock('../api/follow-company.api', () => api)
vi.mock('@/entities/session', () => ({ useCandidateAudience: () => audience.current }))
vi.mock('@/shared/lib/toast', () => ({ message: { error: vi.fn() } }))

const NOT_FOLLOWING = { following: false, notify_new_jobs: false, follower_count: 12 }
const FOLLOWING = { following: true, notify_new_jobs: true, follower_count: 13 }

function renderButton(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onRequireLogin = vi.fn()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <FollowCompanyButton publicId="co_ab12" onRequireLogin={onRequireLogin} {...props} />
    </QueryClientProvider>,
  )
  return { ...view, onRequireLogin }
}

describe('FollowCompanyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    audience.current = 'candidate'
    api.getCompanyFollow.mockResolvedValue(NOT_FOLLOWING)
    api.followCompany.mockResolvedValue(FOLLOWING)
    api.unfollowCompany.mockResolvedValue(NOT_FOLLOWING)
  })

  it('asks a guest to sign in and follows once the login succeeds', async () => {
    const user = userEvent.setup()
    audience.current = 'guest'
    const { onRequireLogin } = renderButton()

    await user.click(screen.getByRole('button', { name: 'Theo dõi' }))

    expect(onRequireLogin).toHaveBeenCalledOnce()
    expect(api.getCompanyFollow).not.toHaveBeenCalled()
    expect(api.followCompany).not.toHaveBeenCalled()

    act(() => onRequireLogin.mock.calls[0][0]())
    await waitFor(() => expect(api.followCompany).toHaveBeenCalledWith('co_ab12', {}))
  })

  it('is not shown to signed-in employers and admins', () => {
    // useCandidateAudience trả null cho mọi vai trò không phải ứng viên.
    audience.current = null
    const { container } = renderButton()

    expect(container).toBeEmptyDOMElement()
    expect(api.getCompanyFollow).not.toHaveBeenCalled()
  })

  it('lets a candidate follow, switch the new-job email off and unfollow', async () => {
    const user = userEvent.setup()
    const { onRequireLogin } = renderButton({ className: 'hidden lg:inline-flex' })

    const follow = screen.getByRole('button', { name: 'Theo dõi' })
    expect(follow).toBeDisabled()
    await waitFor(() => expect(follow).toBeEnabled())
    expect(follow).toHaveAttribute('aria-pressed', 'false')
    expect(follow.parentElement).toHaveClass('follow-company', 'hidden', 'lg:inline-flex')
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()

    await user.click(follow)
    const following = await screen.findByRole('button', { name: 'Đang theo dõi' })
    expect(following).toHaveAttribute('aria-pressed', 'true')
    expect(onRequireLogin).not.toHaveBeenCalled()

    const notify = screen.getByRole('switch', { name: 'Nhận email việc làm mới' })
    expect(notify).toBeChecked()
    await waitFor(() => expect(notify).toBeEnabled())
    api.followCompany.mockResolvedValue({ ...FOLLOWING, notify_new_jobs: false })
    await user.click(notify)
    await waitFor(() => expect(notify).not.toBeChecked())
    expect(api.followCompany).toHaveBeenLastCalledWith('co_ab12', { notify_new_jobs: false })

    await waitFor(() => expect(following).toBeEnabled())
    await user.click(following)
    expect(await screen.findByRole('button', { name: 'Theo dõi' })).toBeInTheDocument()
    expect(api.unfollowCompany).toHaveBeenCalledWith('co_ab12')
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })
})
