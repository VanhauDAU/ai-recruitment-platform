import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { jobKeys } from '../api/job.keys'
import JobListRankingSync from './JobListRankingSync'
import { publishJobListRankingChanged } from './job-list-ranking-sync'

function installBroadcastChannelMock() {
  const channels = new Set()

  class BroadcastChannelMock {
    constructor(name) {
      this.name = name
      this.listeners = new Set()
      channels.add(this)
    }

    addEventListener(type, listener) {
      if (type === 'message') this.listeners.add(listener)
    }

    removeEventListener(type, listener) {
      if (type === 'message') this.listeners.delete(listener)
    }

    postMessage(data) {
      channels.forEach((channel) => {
        if (channel !== this && channel.name === this.name) {
          channel.listeners.forEach((listener) => listener({ data }))
        }
      })
    }

    close() {
      channels.delete(this)
    }
  }

  vi.stubGlobal('BroadcastChannel', BroadcastChannelMock)
}

describe('JobListRankingSync', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('invalidates default lists once for another tab and preserves explicit sorts', async () => {
    installBroadcastChannelMock()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const defaultKey = jobKeys.list(new URLSearchParams('page=1'))
    const newestKey = jobKeys.list(new URLSearchParams('ordering=newest'))
    queryClient.setQueryData(defaultKey, { results: [{ public_id: 'job_1' }] })
    queryClient.setQueryData(newestKey, { results: [{ public_id: 'job_2' }] })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    render(
      <QueryClientProvider client={queryClient}>
        <JobListRankingSync />
      </QueryClientProvider>,
    )

    await act(async () => {
      publishJobListRankingChanged()
    })
    expect(invalidateQueries).not.toHaveBeenCalled()

    await act(async () => {
      publishJobListRankingChanged({ sourceId: 'another-tab' })
    })

    expect(invalidateQueries).toHaveBeenCalledOnce()
    expect(queryClient.getQueryState(defaultKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(newestKey)?.isInvalidated).toBe(false)
  })
})
