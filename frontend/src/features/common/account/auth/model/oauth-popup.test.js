import { afterEach, describe, expect, it, vi } from 'vitest'
import { OAUTH_POPUP_ACK_TIMEOUT_MS, OAUTH_POPUP_CHANNEL, canUseOAuthPopup, createOAuthNonce, relayOAuthResult } from './oauth-popup'

describe('oauth popup helpers', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('creates nonces the backend accepts', () => {
    expect(createOAuthNonce()).toMatch(/^[a-f0-9]{32}$/)
    expect(createOAuthNonce()).not.toBe(createOAuthNonce())
  })

  it('only uses a popup with a fine pointer on a wide screen', () => {
    const matchMedia = vi.fn(() => ({ matches: true }))
    vi.stubGlobal('matchMedia', matchMedia)
    expect(canUseOAuthPopup()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(pointer: fine) and (min-width: 768px)')

    matchMedia.mockReturnValue({ matches: false })
    expect(canUseOAuthPopup()).toBe(false)
  })

  it('resolves true once the opener acknowledges the matching nonce', async () => {
    const opener = new BroadcastChannel(OAUTH_POPUP_CHANNEL)
    opener.onmessage = ({ data }) => {
      opener.postMessage({ type: 'ack', nonce: 'other' })
      opener.postMessage({ type: 'ack', nonce: data.nonce })
    }

    await expect(relayOAuthResult({ nonce: 'n0nce', code: 'c' })).resolves.toBe(true)
    opener.close()
  })

  it('resolves false when nobody acknowledges in time', async () => {
    vi.useFakeTimers()
    const result = relayOAuthResult({ nonce: 'n0nce', error: 'access_denied' })

    await vi.advanceTimersByTimeAsync(OAUTH_POPUP_ACK_TIMEOUT_MS)
    await expect(result).resolves.toBe(false)
  })
})
