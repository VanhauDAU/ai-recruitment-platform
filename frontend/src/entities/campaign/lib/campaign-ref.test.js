import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearStoredCampaignRef, readCampaignRef, storeCampaignRef, CAMPAIGN_REF_STORAGE_KEY } from './campaign-ref'

describe('campaign ref store', () => {
  afterEach(() => {
    vi.useRealTimers()
    storeCampaignRef('', { persist: false })
    clearStoredCampaignRef()
  })

  it('keeps the ref only in memory without consent', () => {
    storeCampaignRef('abc:sig', { persist: false })

    expect(readCampaignRef()).toBe('abc:sig')
    expect(localStorage.getItem(CAMPAIGN_REF_STORAGE_KEY)).toBeNull()
  })

  it('persists for 30 days with consent, then expires', () => {
    vi.useFakeTimers()
    storeCampaignRef('abc:sig', { persist: true })
    storeCampaignRef('', { persist: false })

    expect(readCampaignRef()).toBe('abc:sig')
    vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000)
    expect(readCampaignRef()).toBe('')
  })
})
