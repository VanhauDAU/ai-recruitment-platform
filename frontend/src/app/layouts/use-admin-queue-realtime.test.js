import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminDashboardKeys } from '@/entities/dashboard/admin-dashboard'
import { jobReportKeys } from '@/entities/job/job-report'
import { ADMIN_QUEUE_QUERY_KEYS, useAdminQueueRealtime } from './use-admin-queue-realtime'

const { realtime } = vi.hoisted(() => ({ realtime: { handler: null, enabled: null } }))
vi.mock('@/shared/api/use-realtime', () => ({
  useRealtimeEvents: (handler, { enabled }) => {
    realtime.handler = handler
    realtime.enabled = enabled
  },
}))

function setup(enabled = true) {
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
  const wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)
  renderHook(() => useAdminQueueRealtime(enabled), { wrapper })
  const invalidated = () => invalidate.mock.calls.map(([{ queryKey }]) => queryKey)
  return { invalidate, invalidated }
}

const emit = (event) => act(() => realtime.handler(event))

describe('useAdminQueueRealtime', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('only listens for admins', () => {
    setup(false)
    expect(realtime.enabled).toBe(false)
  })

  it('refreshes the dashboard and the changed queue once per burst', () => {
    const { invalidate, invalidated } = setup()

    emit({ type: 'admin.queue.changed', queue: 'job_reports' })
    emit({ type: 'admin.queue.changed', queue: 'job_reports' })
    expect(invalidate).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(400))

    expect(invalidated()).toEqual([adminDashboardKeys.all, ...ADMIN_QUEUE_QUERY_KEYS.job_reports])
    expect(invalidated()).toContainEqual(jobReportKeys.adminLists)
  })

  it('ignores unrelated or unknown events', () => {
    const { invalidate } = setup()

    emit({ type: 'notification.created', scope: 'employer' })
    emit({ type: 'admin.queue.changed', queue: 'nope' })
    act(() => vi.advanceTimersByTime(1000))

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('catches up on every queue after (re)connecting', () => {
    const { invalidated } = setup()

    emit({ type: 'connected' })
    act(() => vi.advanceTimersByTime(400))

    const expected = Object.values(ADMIN_QUEUE_QUERY_KEYS).flat()
    expect(invalidated()).toEqual(expect.arrayContaining([adminDashboardKeys.all, ...expected]))
  })
})
