import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, user: { public_id: 'candidate-1', role: 'candidate' } },
  getSavedJobs: vi.fn(),
  saveJob: vi.fn(),
  unsaveJob: vi.fn(),
}))

vi.mock('@/entities/session', () => ({ useSession: () => mocks.auth }))
vi.mock('../api/saved-jobs.api', () => ({
  getSavedJobs: mocks.getSavedJobs,
  saveJob: mocks.saveJob,
  unsaveJob: mocks.unsaveJob,
}))

import SavedJobsProvider from './SavedJobsProvider'
import { useSavedJobs } from '../index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function wrapper({ children }) {
  return <SavedJobsProvider>{children}</SavedJobsProvider>
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

describe('SavedJobsProvider mutations', () => {
  beforeEach(() => {
    mocks.auth = { isAuthenticated: true, user: { public_id: 'candidate-1', role: 'candidate' } }
    mocks.getSavedJobs.mockReset()
    mocks.saveJob.mockReset()
    mocks.unsaveJob.mockReset()
    mocks.getSavedJobs.mockResolvedValue([])
  })

  async function renderSavedJobs() {
    const hook = renderHook(() => useSavedJobs(), { wrapper })
    await waitFor(() => expect(mocks.getSavedJobs).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
  }

  it('locks a job while saving so duplicate requests are not sent', async () => {
    const request = deferred()
    mocks.getSavedJobs
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ job_detail: { public_id: 'job-1', title: 'React developer' } }])
    mocks.saveJob.mockReturnValue(request.promise)
    const { result } = await renderSavedJobs()

    let togglePromise
    act(() => {
      togglePromise = result.current.toggle('job-1')
      result.current.toggle('job-1')
    })

    expect(mocks.saveJob).toHaveBeenCalledTimes(1)
    expect(result.current.pendingJobIds.has('job-1')).toBe(true)
    expect(result.current.savedIds.has('job-1')).toBe(true)

    await act(async () => {
      request.resolve({ job_detail: { public_id: 'job-1', title: 'React developer' } })
      await togglePromise
    })

    expect(result.current.pendingJobIds.has('job-1')).toBe(false)
    expect(result.current.savedIds.has('job-1')).toBe(true)
  })

  it('rolls back an optimistic save when the API fails', async () => {
    mocks.saveJob.mockRejectedValue(new Error('save failed'))
    const { result } = await renderSavedJobs()

    await act(async () => {
      await result.current.toggle('job-1')
    })

    expect(result.current.savedIds.has('job-1')).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('rolls back an optimistic unsave when the API fails', async () => {
    mocks.getSavedJobs.mockResolvedValue([{ job_detail: { public_id: 'job-1', title: 'React developer' } }])
    mocks.unsaveJob.mockRejectedValue(new Error('unsave failed'))
    const { result } = await renderSavedJobs()

    await waitFor(() => expect(result.current.savedIds.has('job-1')).toBe(true))
    await act(async () => {
      await result.current.toggle('job-1')
    })

    expect(result.current.savedIds.has('job-1')).toBe(true)
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('resets saved-job state after logout', async () => {
    mocks.getSavedJobs.mockResolvedValue([{ job_detail: { public_id: 'job-1', title: 'React developer' } }])
    const hook = await renderSavedJobs()

    await waitFor(() => expect(hook.result.current.savedIds.has('job-1')).toBe(true))
    mocks.auth = { isAuthenticated: false, user: null }
    hook.rerender()

    await waitFor(() => expect(hook.result.current.items).toEqual([]))
    expect(hook.result.current.pendingJobIds.size).toBe(0)
    expect(hook.result.current.isCandidate).toBe(false)
  })
})
