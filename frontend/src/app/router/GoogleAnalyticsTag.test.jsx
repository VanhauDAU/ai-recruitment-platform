import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GoogleAnalyticsTag from './GoogleAnalyticsTag'

const state = vi.hoisted(() => ({ consent: { analytics: false }, status: 'ready', id: 'G-AB12CD34EF' }))
vi.mock('@/entities/system/consent', () => ({ useConsent: () => ({ consent: state.consent, status: state.status }) }))
vi.mock('@/entities/system/site-settings', () => ({ useSiteSetting: () => state.id }))

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><GoogleAnalyticsTag /></MemoryRouter>)
const gtagScript = () => document.getElementById('procv-gtag')

afterEach(() => {
  gtagScript()?.remove()
  delete window.gtag
  delete window.dataLayer
  delete window['ga-disable-G-AB12CD34EF']
})

describe('GoogleAnalyticsTag', () => {
  it('loads gtag only after Analytics consent, outside the admin portal', async () => {
    state.consent = { analytics: false }
    renderAt('/').unmount()
    expect(gtagScript()).toBeNull()

    state.consent = { analytics: true }
    renderAt('/quan-tri').unmount()
    expect(gtagScript()).toBeNull()

    renderAt('/viec-lam')
    await waitFor(() => expect(gtagScript()).not.toBeNull())
  })

  it('stops sending and drops _ga cookies when consent is withdrawn', async () => {
    state.consent = { analytics: true }
    const view = renderAt('/')
    await waitFor(() => expect(gtagScript()).not.toBeNull())
    document.cookie = '_ga=GA1.1.1.1; path=/'

    state.consent = { analytics: false }
    view.rerender(<MemoryRouter><GoogleAnalyticsTag /></MemoryRouter>)

    await waitFor(() => expect(window['ga-disable-G-AB12CD34EF']).toBe(true))
    expect(document.cookie).not.toContain('_ga')
  })
})
