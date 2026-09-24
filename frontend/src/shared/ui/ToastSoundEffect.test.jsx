import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ToastSoundEffect from './ToastSoundEffect'

const audio = vi.hoisted(() => ({
  close: vi.fn(() => Promise.resolve()),
  createBufferSource: vi.fn(),
  createGain: vi.fn(),
  decodeAudioData: vi.fn(),
  fetch: vi.fn(),
  resume: vi.fn(() => Promise.resolve()),
  sourceStart: vi.fn(),
}))

function appendToast(className) {
  const toast = document.createElement('li')
  toast.dataset.sonnerToast = ''
  if (className) toast.classList.add(className)
  act(() => document.body.append(toast))
  return toast
}

describe('ToastSoundEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const source = {
      connect: vi.fn(),
      start: audio.sourceStart,
      buffer: null,
    }
    const gain = {
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn() },
    }
    const context = {
      state: 'running',
      currentTime: 1,
      destination: {},
      close: audio.close,
      createBufferSource: audio.createBufferSource.mockReturnValue(source),
      createGain: audio.createGain.mockReturnValue(gain),
      decodeAudioData: audio.decodeAudioData.mockResolvedValue({ decoded: true }),
      resume: audio.resume,
    }
    vi.stubGlobal('fetch', audio.fetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }))
    vi.stubGlobal('AudioContext', vi.fn(function MockAudioContext() {
      return context
    }))
  })

  afterEach(() => {
    document.querySelectorAll('[data-sonner-toast]').forEach((toast) => toast.remove())
    vi.unstubAllGlobals()
  })

  it('plays notification for ordinary toasts', async () => {
    render(<ToastSoundEffect />)
    appendToast()

    await waitFor(() => {
      expect(audio.fetch).toHaveBeenCalledWith('/audio/effects/notification.mp3')
      expect(audio.sourceStart).toHaveBeenCalledTimes(1)
    })
  })

  it('plays done instead of notification for an explicitly tagged toast', async () => {
    render(<ToastSoundEffect />)
    const toast = appendToast('app-toast--sound-done')

    await waitFor(() => {
      expect(audio.fetch).toHaveBeenCalledWith('/audio/effects/done.mp3')
      expect(audio.sourceStart).toHaveBeenCalledTimes(1)
    })
    expect(audio.fetch).not.toHaveBeenCalledWith('/audio/effects/notification.mp3')

    act(() => toast.setAttribute('aria-live', 'polite'))
    expect(audio.sourceStart).toHaveBeenCalledTimes(1)
  })
})
