import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useJobListData from './use-job-list-data'

const mocks = vi.hoisted(() => ({
  getJobs: vi.fn(),
}))

vi.mock('@/entities/job', () => ({
  getJobs: mocks.getJobs,
  jobKeys: {
    list: (params) => ['jobs', 'list', params.toString()],
  },
}))

describe('useJobListData', () => {
  afterEach(() => {
    mocks.getJobs.mockReset()
  })

  it('blocks query-key transitions without hiding cards during same-key background sync', async () => {
    mocks.getJobs.mockResolvedValue({ count: 1, results: [{ public_id: 'job_1' }] })
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          retry: false,
          staleTime: 60_000,
        },
      },
    })
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result, rerender } = renderHook(
      ({ search }) => useJobListData(new URLSearchParams(search)),
      { initialProps: { search: '' }, wrapper },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.getJobs).toHaveBeenCalledTimes(1)
    const initialRankingSeed = mocks.getJobs.mock.calls[0][0].get('ranking_seed')
    expect(initialRankingSeed).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
    let resolveTransition
    mocks.getJobs.mockImplementationOnce(() => new Promise((resolve) => {
      resolveTransition = resolve
    }))
    rerender({ search: 'page=2' })

    await waitFor(() => expect(mocks.getJobs).toHaveBeenCalledTimes(2))
    expect(mocks.getJobs.mock.calls[1][0].get('ranking_seed')).toBe(initialRankingSeed)
    expect(result.current.loading).toBe(true)

    await act(async () => resolveTransition({
      count: 1,
      results: [{ public_id: 'job_2' }],
    }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let resolveBackground
    mocks.getJobs.mockImplementationOnce(() => new Promise((resolve) => {
      resolveBackground = resolve
    }))
    act(() => {
      void queryClient.invalidateQueries({ queryKey: ['jobs', 'list'] })
    })
    await waitFor(() => expect(mocks.getJobs).toHaveBeenCalledTimes(3))
    expect(result.current.loading).toBe(false)
    expect(result.current.refreshing).toBe(true)
    expect(result.current.results).toEqual([{ public_id: 'job_2' }])

    await act(async () => resolveBackground({
      count: 1,
      results: [{ public_id: 'job_2_refreshed' }],
    }))
    await waitFor(() => expect(result.current.refreshing).toBe(false))
    expect(result.current.results).toEqual([{ public_id: 'job_2_refreshed' }])
  })

  it('does not send a rotation seed for an explicit user-selected ordering', async () => {
    mocks.getJobs.mockResolvedValue({ count: 0, results: [] })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    renderHook(
      () => useJobListData(new URLSearchParams('sort=newest')),
      { wrapper },
    )

    await waitFor(() => expect(mocks.getJobs).toHaveBeenCalledTimes(1))
    expect(mocks.getJobs.mock.calls[0][0].get('ordering')).toBe('newest')
    expect(mocks.getJobs.mock.calls[0][0].has('ranking_seed')).toBe(false)
  })
})
