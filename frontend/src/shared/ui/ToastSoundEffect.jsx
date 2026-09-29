import { useEffect } from 'react'
import { getSoundEffect, getToastSoundName, SOUND_EFFECTS } from '@/shared/lib/sound-effects'

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
      if (audioContext) return audioContext
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return null
      audioContext = new AudioContext()
      return audioContext
    }

    const loadSound = (name) => {
      if (buffers.has(name)) return Promise.resolve(buffers.get(name))
      if (loadingSounds.has(name)) return loadingSounds.get(name)

      const effect = getSoundEffect(name)
      const audioContext = getAudioContext()
      if (!effect || !audioContext) return Promise.resolve(null)

      const loading = fetch(effect.src)
        .then((response) => {
          if (!response.ok) throw new Error(`Could not load sound effect: ${name}`)
          return response.arrayBuffer()
        })
        .then((audioData) => audioContext.decodeAudioData(audioData))
        .then((buffer) => {
          if (active) buffers.set(name, buffer)
          return buffer
        })
        .catch(() => null)
        .finally(() => loadingSounds.delete(name))

      loadingSounds.set(name, loading)
      return loading
    }

    const unlockAudio = () => {
      const audioContext = getAudioContext()
      if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {})
      Object.keys(SOUND_EFFECTS).forEach((name) => loadSound(name))
    }

    const playSound = (name, buffer) => {
      const currentAudioContext = audioContext
      const effect = getSoundEffect(name)
      if (!active || !currentAudioContext || currentAudioContext.state !== 'running' || !effect || !buffer) return

      const source = currentAudioContext.createBufferSource()
      const gain = currentAudioContext.createGain()
      source.buffer = buffer
      gain.gain.setValueAtTime(effect.volume, currentAudioContext.currentTime)
      source.connect(gain)
      gain.connect(currentAudioContext.destination)
      source.start()
    }

    const playToastSound = (toast) => {
      if (playedToasts.has(toast)) return
      playedToasts.add(toast)

      const audioContext = getAudioContext()
      if (!audioContext) return

      const soundName = getToastSoundName(toast)
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
