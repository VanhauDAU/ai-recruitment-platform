import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CAMPAIGN_REF_STORAGE_KEY, clearStoredCampaignRef, readCampaignRef, storeCampaignRef } from '@/entities/campaign/campaign'
import { CampaignRefCapture } from './use-capture-campaign-ref'

const consentState = vi.hoisted(() => ({ consent: { necessary: true, analytics: false }, status: 'ready' }))
vi.mock('@/entities/system/consent', () => ({ useConsent: () => consentState }))

function Location() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>
}

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="*" element={<><CampaignRefCapture /><Location /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CampaignRefCapture', () => {
  afterEach(() => {
    storeCampaignRef('', { persist: false })
    clearStoredCampaignRef()
  })

  it('keeps the ref for the session only without analytics consent and cleans the URL', async () => {
    consentState.status = 'ready'
    consentState.consent = { necessary: true, analytics: false }
    renderAt('/tuyen-dung/dot-tuyen?ref=abc:sig&tab=1')

    expect(await screen.findByTestId('location')).toHaveTextContent('/tuyen-dung/dot-tuyen?tab=1')
    expect(readCampaignRef()).toBe('abc:sig')
    expect(localStorage.getItem(CAMPAIGN_REF_STORAGE_KEY)).toBeNull()
  })

  it('persists the ref with analytics consent', async () => {
    consentState.status = 'ready'
    consentState.consent = { necessary: true, analytics: true }
    renderAt('/viec-lam/backend?ref=xyz:sig')

    expect(await screen.findByTestId('location')).toHaveTextContent('/viec-lam/backend')
    expect(JSON.parse(localStorage.getItem(CAMPAIGN_REF_STORAGE_KEY)).ref).toBe('xyz:sig')
  })

  it('does not persist from a stale local mirror while server consent is loading', () => {
    consentState.status = 'loading'
    consentState.consent = { necessary: true, analytics: true }
    renderAt('/viec-lam/backend?ref=old:sig')

    expect(screen.getByTestId('location')).toHaveTextContent('/viec-lam/backend?ref=old:sig')
    expect(localStorage.getItem(CAMPAIGN_REF_STORAGE_KEY)).toBeNull()
  })
})
