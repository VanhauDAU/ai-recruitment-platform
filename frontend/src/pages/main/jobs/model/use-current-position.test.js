import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useCurrentPosition from './use-current-position'

function stubGeolocation(getCurrentPosition) {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: getCurrentPosition && { getCurrentPosition } })
}

async function locate(result) {
  let position
  await act(async () => {
    position = await result.current.locate()
  })
  return position
}

describe('useCurrentPosition', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    stubGeolocation(undefined)
  })

  it('returns the device position with accuracy in km', async () => {
    stubGeolocation((ok) => ok({ coords: { latitude: 21.03, longitude: 105.85, accuracy: 1500 } }))
    const { result } = renderHook(() => useCurrentPosition())
    expect(await locate(result)).toEqual({ latitude: 21.03, longitude: 105.85, accuracyKm: 1.5 })
    expect(result.current.error).toBeNull()
  })

  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ])('maps browser error code %i to %s', async (code, expected) => {
    stubGeolocation((_, fail) => fail({ code }))
    const { result } = renderHook(() => useCurrentPosition())
    expect(await locate(result)).toBeNull()
    expect(result.current.error).toBe(expected)
  })

  it('rejects positions outside Vietnam', async () => {
    stubGeolocation((ok) => ok({ coords: { latitude: 13.75, longitude: 100.5, accuracy: 20 } }))
    const { result } = renderHook(() => useCurrentPosition())
    expect(await locate(result)).toBeNull()
    expect(result.current.error).toBe('outside')
  })

  it('explains missing support and insecure pages without asking', async () => {
    stubGeolocation(undefined)
    const { result } = renderHook(() => useCurrentPosition())
    await locate(result)
    expect(result.current.error).toBe('unsupported')

    vi.stubGlobal('isSecureContext', false)
    await locate(result)
    expect(result.current.error).toBe('insecure')
  })
})
