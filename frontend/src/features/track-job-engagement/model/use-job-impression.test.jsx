import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetJobImpressionQueue } from './impression-queue'
import { useJobImpression } from './use-job-impression'

const mocks = vi.hoisted(() => ({
  consent: { analytics: true },
  consentStatus: 'ready',
  recordJobImpressions: vi.fn(),
}))

vi.mock('@/entities/consent', () => ({
  useConsent: () => ({ consent: mocks.consent, status: mocks.consentStatus }),
}))
vi.mock('@/entities/job', () => ({
  recordJobImpressions: mocks.recordJobImpressions,
}))

class IntersectionObserverMock {
  static instances = []

  constructor(callback, options) {
    this.callback = callback
    this.options = options
    this.disconnect = vi.fn()
    this.observe = vi.fn()
    IntersectionObserverMock.instances.push(this)
  }

  emit(ratio) {
    this.callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio }])
  }
}

function JobCard({ slug }) {
  const ref = useJobImpression(slug)
  return <article ref={ref}>{slug}</article>
}

describe('useJobImpression', () => {
  let visibilityState = 'visible'

  beforeEach(() => {
    vi.useFakeTimers()
    visibilityState = 'visible'
    mocks.consent = { analytics: true }
    mocks.consentStatus = 'ready'
    mocks.recordJobImpressions.mockReset().mockResolvedValue({ results: [] })
    IntersectionObserverMock.instances = []
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })
  })

  afterEach(() => {
    resetJobImpressionQueue()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('counts only after at least half the card is visible continuously for one second', async () => {
    render(<JobCard slug="backend-engineer" />)
    const observer = IntersectionObserverMock.instances[0]

    act(() => observer.emit(0.49))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(mocks.recordJobImpressions).not.toHaveBeenCalled()

    act(() => observer.emit(0.5))
    await act(() => vi.advanceTimersByTimeAsync(999))
    expect(mocks.recordJobImpressions).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(251))

    expect(mocks.recordJobImpressions).toHaveBeenCalledWith(['backend-engineer'])
  })

  it('cancels the continuous timer when the tab becomes hidden', async () => {
    render(<JobCard slug="frontend-engineer" />)
    const observer = IntersectionObserverMock.instances[0]
    act(() => observer.emit(0.8))
    await act(() => vi.advanceTimersByTimeAsync(600))

    visibilityState = 'hidden'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(() => vi.advanceTimersByTimeAsync(1000))

    expect(mocks.recordJobImpressions).not.toHaveBeenCalled()
  })

  it('does not observe or send when analytics consent is unavailable', () => {
    mocks.consent = { analytics: false }

    render(<JobCard slug="data-engineer" />)

    expect(IntersectionObserverMock.instances).toHaveLength(0)
    expect(mocks.recordJobImpressions).not.toHaveBeenCalled()
  })

  it('batches multiple viewable cards into one request', async () => {
    render(
      <>
        <JobCard slug="job-one" />
        <JobCard slug="job-two" />
      </>,
    )
    act(() => {
      IntersectionObserverMock.instances.forEach((observer) => observer.emit(1))
    })
    await act(() => vi.advanceTimersByTimeAsync(1250))

    expect(mocks.recordJobImpressions).toHaveBeenCalledOnce()
    expect(mocks.recordJobImpressions).toHaveBeenCalledWith(['job-one', 'job-two'])
  })
})
