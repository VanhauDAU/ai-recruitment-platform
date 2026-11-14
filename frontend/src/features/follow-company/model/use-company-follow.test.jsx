import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { companyKeys } from '@/entities/company'
import { followCompanyKeys } from '../api/follow-company.keys'
import { useCompanyFollow } from './use-company-follow'

const { api, audience, toast } = vi.hoisted(() => ({
  api: { getCompanyFollow: vi.fn(), followCompany: vi.fn(), unfollowCompany: vi.fn() },
  audience: { current: 'candidate' },
  toast: { error: vi.fn() },
}))

vi.mock('../api/follow-company.api', () => api)
vi.mock('@/entities/session', () => ({ useCandidateAudience: () => audience.current }))
vi.mock('@/shared/lib/toast', () => ({ message: toast }))

const PUBLIC_ID = 'co_ab12'
const DETAIL_KEY = companyKeys.detail('fpt-software')
const LIST_KEY = followCompanyKeys.followedList(1)

function deferred() {
  let resolve
  let reject
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

function setup({ knownStatus } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(DETAIL_KEY, { public_id: PUBLIC_ID, stats: { active_public_job_count: 3, follower_count: 12 } })
  queryClient.setQueryData(companyKeys.detail('cmc-global'), { public_id: 'co_other', stats: { follower_count: 5 } })
  const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const view = renderHook(() => useCompanyFollow(PUBLIC_ID, knownStatus), { wrapper })
  return {
    ...view,
    queryClient,
    followerCount: (key = DETAIL_KEY) => queryClient.getQueryData(key).stats.follower_count,
  }
}

describe('useCompanyFollow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    audience.current = 'candidate'
    api.getCompanyFollow.mockResolvedValue({ following: false, notify_new_jobs: false, follower_count: 12 })
  })

  it('reads the follow status only for a signed-in candidate', async () => {
    audience.current = 'guest'
    const guest = setup()
    expect(guest.result.current).toMatchObject({ following: false, isLoading: false })
    expect(api.getCompanyFollow).not.toHaveBeenCalled()
    guest.unmount()

    audience.current = 'candidate'
    const candidate = setup()
    expect(candidate.result.current.isLoading).toBe(true)
    await waitFor(() => expect(candidate.result.current.isLoading).toBe(false))
    expect(api.getCompanyFollow).toHaveBeenCalledWith(PUBLIC_ID, { signal: expect.anything() })
    expect(candidate.result.current.following).toBe(false)
  })

  it('follows optimistically, then replaces the guess with the server status and count', async () => {
    const request = deferred()
    api.followCompany.mockReturnValue(request.promise)
    const { result, followerCount } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setFollowing(true))

    await waitFor(() => expect(result.current.following).toBe(true))
    expect(result.current).toMatchObject({ notifyNewJobs: true, isPending: true })
    expect(followerCount()).toBe(13)
    expect(followerCount(companyKeys.detail('cmc-global'))).toBe(5)
    expect(api.followCompany).toHaveBeenCalledWith(PUBLIC_ID, {})

    await act(async () => request.resolve({ following: true, notify_new_jobs: true, follower_count: 20 }))

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.following).toBe(true)
    expect(followerCount()).toBe(20)
  })

  it('rolls the button and the cached follower count back when the server rejects', async () => {
    const request = deferred()
    api.followCompany.mockReturnValue(request.promise)
    const { result, followerCount } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setFollowing(true))
    await waitFor(() => expect(followerCount()).toBe(13))

    await act(async () => request.reject({ response: { status: 500 } }))

    await waitFor(() => expect(result.current.following).toBe(false))
    expect(followerCount()).toBe(12)
    expect(toast.error).toHaveBeenCalledWith('Hệ thống đang gặp lỗi. Vui lòng thử lại sau ít phút.')
  })

  it('explains a company that was hidden in the meantime', async () => {
    api.followCompany.mockRejectedValue({ response: { status: 404, data: { detail: 'Không tìm thấy.' } } })
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setFollowing(true))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Trang công ty này không còn được hiển thị.'))
  })

  it('switches the email preference without changing the follower count', async () => {
    api.getCompanyFollow.mockResolvedValue({ following: true, notify_new_jobs: true, follower_count: 12 })
    api.followCompany.mockResolvedValue({ following: true, notify_new_jobs: false, follower_count: 12 })
    const { result, followerCount } = setup()
    await waitFor(() => expect(result.current.following).toBe(true))

    act(() => result.current.setNotifyNewJobs(false))

    await waitFor(() => expect(result.current.notifyNewJobs).toBe(false))
    expect(api.followCompany).toHaveBeenCalledWith(PUBLIC_ID, { notify_new_jobs: false })
    expect(followerCount()).toBe(12)
  })

  it('unfollows from a followed-list row without reading the status and restores the row on failure', async () => {
    const request = deferred()
    api.unfollowCompany.mockReturnValue(request.promise)
    const { result, queryClient, followerCount } = setup({ knownStatus: { following: true, notify_new_jobs: true } })
    queryClient.setQueryData(LIST_KEY, {
      count: 2,
      results: [{ public_id: PUBLIC_ID, notify_new_jobs: true }, { public_id: 'co_other', notify_new_jobs: false }],
    })

    expect(result.current).toMatchObject({ following: true, notifyNewJobs: true, isLoading: false })
    act(() => result.current.setFollowing(false))

    await waitFor(() => expect(queryClient.getQueryData(LIST_KEY)).toEqual({
      count: 1,
      results: [{ public_id: 'co_other', notify_new_jobs: false }],
    }))
    expect(followerCount()).toBe(11)
    expect(api.getCompanyFollow).not.toHaveBeenCalled()

    await act(async () => request.reject({ response: { status: 500 } }))

    await waitFor(() => expect(queryClient.getQueryData(LIST_KEY).count).toBe(2))
    expect(queryClient.getQueryData(LIST_KEY).results).toHaveLength(2)
    expect(followerCount()).toBe(12)
    expect(queryClient.getQueryData(followCompanyKeys.status(PUBLIC_ID))).toBeUndefined()
  })

  it('refreshes the followed list after a confirmed change', async () => {
    api.unfollowCompany.mockResolvedValue({ following: false, notify_new_jobs: false, follower_count: 11 })
    const { result, queryClient } = setup({ knownStatus: { following: true, notify_new_jobs: true } })
    queryClient.setQueryData(LIST_KEY, { count: 1, results: [{ public_id: PUBLIC_ID, notify_new_jobs: true }] })

    act(() => result.current.setFollowing(false))

    await waitFor(() => expect(queryClient.getQueryState(LIST_KEY).isInvalidated).toBe(true))
    expect(queryClient.getQueryData(followCompanyKeys.status(PUBLIC_ID)))
      .toEqual({ following: false, notify_new_jobs: false, follower_count: 11 })
  })
})
