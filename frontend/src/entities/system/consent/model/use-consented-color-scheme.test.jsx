import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConsentContext } from './consent-context'
import { useConsentedColorScheme } from './use-consented-color-scheme'

const READY = { consent: { necessary: true, preferences: true }, status: 'ready' }

function Probe() {
  useConsentedColorScheme()
  return null
}

function renderWithConsent(value = READY) {
  return render(
    <ConsentContext.Provider value={value}>
      <Probe />
    </ConsentContext.Provider>,
  )
}

describe('useConsentedColorScheme', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    vi.restoreAllMocks()
  })

  it('applies the stored dark choice while mounted', async () => {
    localStorage.setItem('color-scheme', 'dark')
    renderWithConsent()
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true))
  })

  it('removes the dark class on unmount so light-only layouts are not affected', async () => {
    localStorage.setItem('color-scheme', 'dark')
    const { unmount } = renderWithConsent()
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true))

    unmount()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
