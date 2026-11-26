import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TOAST_SOUND,
  isSoundOn,
  getSoundEffect,
  getToastSoundName,
  toastSoundOptions,
} from './sound-effects'

describe('sound effects registry', () => {
  it('maps semantic toast options to the done sound', () => {
    expect(toastSoundOptions('done')).toEqual({ className: 'app-toast--sound-done' })
    expect(getSoundEffect('done')).toMatchObject({
      src: '/audio/effects/done.mp3',
    })
    expect(getSoundEffect('done').volume).toBeGreaterThan(0)
    expect(getSoundEffect('done').volume).toBeLessThanOrEqual(1)
  })

  it('uses notification for ordinary toasts and ignores unknown options', () => {
    const toast = document.createElement('li')
    expect(getToastSoundName(toast)).toBe(DEFAULT_TOAST_SOUND)
    expect(toastSoundOptions('unknown')).toEqual({})
  })

  it('reads an explicit sound from the rendered toast class', () => {
    const toast = document.createElement('li')
    toast.classList.add('app-toast--sound-done')
    expect(getToastSoundName(toast)).toBe('done')
  })

  it('registers celebrate as a lazy effect that follows the sound switch', () => {
    expect(toastSoundOptions('celebrate')).toEqual({ className: 'app-toast--sound-celebrate' })
    expect(getSoundEffect('celebrate')).toMatchObject({
      src: '/audio/effects/celebrate.mp3',
      preload: false,
      followsMute: true,
    })
  })

  it('registers a lazy message sound for Connect', () => {
    expect(getSoundEffect('message')).toMatchObject({ src: '/audio/effects/message.mp3', preload: false })
  })

  it('reads the sound switch from storage', () => {
    expect(isSoundOn()).toBe(true)
    localStorage.setItem('procv:notification-sound', 'off')
    expect(isSoundOn()).toBe(false)
    localStorage.removeItem('procv:notification-sound')
  })
})
