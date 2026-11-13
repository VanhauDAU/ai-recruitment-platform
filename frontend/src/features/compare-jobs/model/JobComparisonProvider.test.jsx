import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobComparisonProvider from './JobComparisonProvider'
import { COMPARISON_STORAGE_KEY } from './comparison-storage'
import useJobComparison from './use-job-comparison'

const consentState = vi.hoisted(() => ({
  consent: { preferences: false },
  openSettings: vi.fn(),
  status: 'ready',
}))

vi.mock('@/entities/consent', () => ({
  useConsent: () => consentState,
}))

const frontend = {
  public_id: 'job-1',
  slug: 'frontend-engineer',
  title: 'Frontend Engineer',
  company_name: 'ProCV',
}

function wrapper({ children }) {
  return <JobComparisonProvider>{children}</JobComparisonProvider>
}

describe('JobComparisonProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    consentState.consent = { preferences: false }
    consentState.status = 'ready'
    consentState.openSettings.mockClear()
  })

  it('keeps working in memory and removes browser persistence without preference consent', async () => {
    window.localStorage.setItem(COMPARISON_STORAGE_KEY, '{"version":1,"items":[]}')
    const { result } = renderHook(() => useJobComparison(), { wrapper })

    act(() => result.current.toggleJob(frontend))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.persistence).toBe('memory')
    await waitFor(() => expect(window.localStorage.getItem(COMPARISON_STORAGE_KEY)).toBeNull())
  })

  it('restores consented data and synchronizes a newer tab payload', async () => {
    consentState.consent = { preferences: true }
    window.localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify({ version: 1, items: [frontend] }))
    const { result } = renderHook(() => useJobComparison(), { wrapper })

    await waitFor(() => expect(result.current.items[0]?.slug).toBe('frontend-engineer'))

    const backend = { ...frontend, public_id: 'job-2', slug: 'backend-engineer', title: 'Backend Engineer' }
    window.localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify({ version: 1, items: [backend] }))
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: COMPARISON_STORAGE_KEY })))

    await waitFor(() => expect(result.current.items.map((item) => item.slug)).toEqual(['backend-engineer']))
    expect(result.current.persistence).toBe('browser')
  })
})
