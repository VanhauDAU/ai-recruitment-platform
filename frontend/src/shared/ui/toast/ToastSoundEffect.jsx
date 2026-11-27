import { useEffect } from 'react'
import { getSoundEffect, getToastSoundName, isSoundOn, SOUND_EFFECTS } from '@/shared/lib/sound-effects'
import { createAudioContext, decodeSoundEffect, playSoundBuffer } from '@/shared/lib/sound-player'

const TOAST_SELECTOR = '[data-sonner-toast]'

/**
 * Plays short, reusable UI sound assets for the global Sonner toast layer.
 * Browser audio is unlocked on the first interaction; playback remains
 * best-effort and never blocks the workflow that created the toast.
 */
export default function ToastSoundEffect() {
  useEffect(() => {
    let active = true
    let audioContext = null
    const buffers = new Map()
    const loadingSounds = new Map()
    const playedToasts = new WeakSet()

    const getAudioContext = () => {
      audioContext ||= createAudioContext()
      return audioContext
    }

    const loadSound = (name) => {
      if (buffers.has(name)) return Promise.resolve(buffers.get(name))
      if (loadingSounds.has(name)) return loadingSounds.get(name)

      const loading = decodeSoundEffect(getAudioContext(), name)
        .then((buffer) => {
          if (active && buffer) buffers.set(name, buffer)
          return buffer
        })
        .finally(() => loadingSounds.delete(name))

      loadingSounds.set(name, loading)
      return loading
    }

    const unlockAudio = () => {
      const audioContext = getAudioContext()
      if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {})
      Object.entries(SOUND_EFFECTS).forEach(([name, effect]) => effect.preload !== false && loadSound(name))
    }

    const playSound = (name, buffer) => {
      const effect = getSoundEffect(name)
      if (active && effect) playSoundBuffer(audioContext, buffer, effect.volume)
    }

    const playToastSound = (toast) => {
      if (playedToasts.has(toast)) return
      playedToasts.add(toast)

      const audioContext = getAudioContext()
      if (!audioContext) return

      const soundName = getToastSoundName(toast)
      if (!soundName || (getSoundEffect(soundName).followsMute && !isSoundOn())) return
      const ready = audioContext.state === 'running'
        ? Promise.resolve()
        : audioContext.resume().catch(() => {})
      Promise.all([ready, loadSound(soundName)])
        .then(([, buffer]) => playSound(soundName, buffer))
        .catch(() => {})
    }

    const playAddedToast = (node) => {
      if (!(node instanceof Element)) return
      if (node.matches(TOAST_SELECTOR)) {
        playToastSound(node)
        return
      }
      node.querySelectorAll(TOAST_SELECTOR).forEach(playToastSound)
    }

    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(playAddedToast))
    })

    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true })
    window.addEventListener('keydown', unlockAudio, { capture: true })

    return () => {
      active = false
      observer.disconnect()
      window.removeEventListener('pointerdown', unlockAudio, { capture: true })
      window.removeEventListener('keydown', unlockAudio, { capture: true })
      audioContext?.close().catch(() => {})
      audioContext = null
      buffers.clear()
      loadingSounds.clear()
    }
  }, [])

  return null
}
