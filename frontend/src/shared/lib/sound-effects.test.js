import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TOAST_SOUND,
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
})
