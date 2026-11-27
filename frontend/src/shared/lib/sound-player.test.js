import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SOUND_PREFERENCE_KEY } from './sound-effects'

const gain = { connect: vi.fn(), gain: { setValueAtTime: vi.fn() } }
const start = vi.fn()

beforeEach(() => {
  vi.resetModules()
  start.mockClear()
  gain.gain.setValueAtTime.mockClear()
  window.localStorage.removeItem(SOUND_PREFERENCE_KEY)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }))
  vi.stubGlobal('AudioContext', vi.fn(function MockAudioContext() {
    return {
      state: 'running',
      currentTime: 0,
      destination: {},
      resume: () => Promise.resolve(),
      decodeAudioData: () => Promise.resolve({ decoded: true }),
      createBufferSource: () => ({ connect: vi.fn(), start }),
      createGain: () => gain,
    }
  }))
})

afterEach(() => vi.unstubAllGlobals())

test('plays the page-flip sound at its own volume, loading the file once', async () => {
  const { playSoundEffect } = await import('./sound-player')

  playSoundEffect('pageFlip')
  playSoundEffect('pageFlip')

  await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2))
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('/audio/effects/page-flip.mp3')
  expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.35, 0)
})

test('stays silent when the user has muted sounds', async () => {
  window.localStorage.setItem(SOUND_PREFERENCE_KEY, 'off')
  const { playSoundEffect } = await import('./sound-player')

  playSoundEffect('pageFlip')

  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(fetch).not.toHaveBeenCalled()
  expect(start).not.toHaveBeenCalled()
})

test('a page turned by the book itself only plays once a tap has unlocked audio', async () => {
  const { playSoundEffect } = await import('./sound-player')

  playSoundEffect('pageFlip', { onlyIfUnlocked: true })
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(fetch).not.toHaveBeenCalled()

  playSoundEffect('pageFlip')
  playSoundEffect('pageFlip', { onlyIfUnlocked: true })
  await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2))
})
