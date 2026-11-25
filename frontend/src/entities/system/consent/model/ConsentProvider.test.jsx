import { act, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONSENT_STORAGE_KEY } from '../lib/consent-storage'
import ConsentProvider from './ConsentProvider'
import { useConsent } from './consent-context'

const api = vi.hoisted(() => ({ getConsent: vi.fn(), saveConsent: vi.fn() }))
vi.mock('../api/consent.api', () => api)

const ALL_ON = { necessary: true, preferences: true, analytics: true, marketing: true }
const ALL_OFF = { necessary: true, preferences: false, analytics: false, marketing: false }

let context
function Probe() {
  context = useConsent()
  return null
}

function seedOptionalStorage() {
  localStorage.setItem('search_history', '[{"q":"react"}]')
  localStorage.setItem('saved_job_filter', 'category=1')
  localStorage.setItem('procv_campaign_ref_v1', '{"ref":"x"}')
}

describe('ConsentProvider', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('purges optional storage the server-side consent does not allow', async () => {
    seedOptionalStorage()
    api.getConsent.mockResolvedValue({ ...ALL_OFF, preferences: true })
    render(<ConsentProvider><Probe /></ConsentProvider>)

    await waitFor(() => expect(context.status).toBe('ready'))
    expect(localStorage.getItem('search_history')).not.toBeNull()
    expect(localStorage.getItem('procv_campaign_ref_v1')).toBeNull()
  })

  it('fails closed when the consent API errors: clears the mirror and optional storage', async () => {
    seedOptionalStorage()
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(ALL_ON))
    api.getConsent.mockRejectedValue(new Error('offline'))
    render(<ConsentProvider><Probe /></ConsentProvider>)

    await waitFor(() => expect(context.status).toBe('error'))
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem('search_history')).toBeNull()
    expect(localStorage.getItem('saved_job_filter')).toBeNull()
  })

  it('deletes stored data as soon as the user withdraws a category', async () => {
    api.getConsent.mockResolvedValue(ALL_ON)
    render(<ConsentProvider><Probe /></ConsentProvider>)
    await waitFor(() => expect(context.status).toBe('ready'))
    seedOptionalStorage()

    api.saveConsent.mockResolvedValue(ALL_OFF)
    await act(() => context.updateConsent(ALL_OFF))

    expect(localStorage.getItem('search_history')).toBeNull()
    expect(localStorage.getItem('saved_job_filter')).toBeNull()
    expect(localStorage.getItem('procv_campaign_ref_v1')).toBeNull()
  })
})
