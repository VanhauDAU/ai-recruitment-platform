import { afterEach, describe, expect, it, vi } from 'vitest'
import { publishSavedJobsChanged, subscribeSavedJobsSync } from './saved-jobs-sync'

describe('saved jobs synchronization', () => {
  let unsubscribe = () => {}

  afterEach(() => {
    unsubscribe()
    unsubscribe = () => {}
  })

  it('notifies another provider about a saved-job change', () => {
    const callback = vi.fn()
    unsubscribe = subscribeSavedJobsSync(callback, { sourceId: 'receiver' })

    publishSavedJobsChanged({ candidateKey: 'candidate-1', sourceId: 'sender' })

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ candidateKey: 'candidate-1' }))
  })

  it('does not notify the provider that published the event', () => {
    const callback = vi.fn()
    unsubscribe = subscribeSavedJobsSync(callback, { sourceId: 'same-provider' })

    publishSavedJobsChanged({ candidateKey: 'candidate-1', sourceId: 'same-provider' })

    expect(callback).not.toHaveBeenCalled()
  })

  it('refreshes when the browser window regains focus', () => {
    const callback = vi.fn()
    unsubscribe = subscribeSavedJobsSync(callback)

    window.dispatchEvent(new Event('focus'))

    expect(callback).toHaveBeenCalledTimes(1)
  })
})
