import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useJobView } from './use-job-view'

const mocks = vi.hoisted(() => ({
  consent: { analytics: true },
  consentStatus: 'ready',
  recordJobView: vi.fn(),
}))

vi.mock('@/entities/consent', () => ({
  useConsent: () => ({ consent: mocks.consent, status: mocks.consentStatus }),
}))
vi.mock('@/entities/job', () => ({ recordJobView: mocks.recordJobView }))

describe('useJobView', () => {
  let visibilityState = 'visible'

  beforeEach(() => {
    vi.useFakeTimers()
    visibilityState = 'visible'
    mocks.consent = { analytics: true }
    mocks.consentStatus = 'ready'
    mocks.recordJobView.mockReset().mockResolvedValue({ counted: true, view_count: 1 })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('records a full detail or quick view after content stays visible for one second', async () => {
    const onTracked = vi.fn()
    renderHook(() => useJobView('backend-engineer', { onTracked }))

    await act(() => vi.advanceTimersByTimeAsync(999))
    expect(mocks.recordJobView).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(mocks.recordJobView).toHaveBeenCalledOnce()
    expect(mocks.recordJobView).toHaveBeenCalledWith('backend-engineer')
    expect(onTracked).toHaveBeenCalledWith({ counted: true, view_count: 1 })
  })

  it('restarts the one-second window after returning to a visible tab', async () => {
    renderHook(() => useJobView('frontend-engineer'))
    await act(() => vi.advanceTimersByTimeAsync(600))
    visibilityState = 'hidden'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(mocks.recordJobView).not.toHaveBeenCalled()

    visibilityState = 'visible'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(() => vi.advanceTimersByTimeAsync(1000))

    expect(mocks.recordJobView).toHaveBeenCalledOnce()
  })
})
