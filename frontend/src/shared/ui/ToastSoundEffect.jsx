import { useEffect, useRef } from 'react'

const TOAST_SELECTOR = '[data-sonner-toast]'

function toastTone(node) {
  if (node.dataset.type === 'error') return 280
  if (node.dataset.type === 'warning') return 500
  if (node.dataset.type === 'info') return 620
  return 740
}

/**
 * Plays a subtle, generated tone whenever the global Sonner toast layer
 * receives a toast. No audio file is loaded, and sound remains opt-in through
 * the browser's first user interaction policy.
 */
export default function ToastSoundEffect() {
  const audioContextRef = useRef(null)
  const playedToastsRef = useRef(new WeakSet())

  useEffect(() => {
    const getAudioContext = () => {
      if (audioContextRef.current) return audioContextRef.current
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return null
      audioContextRef.current = new AudioContext()
      return audioContextRef.current
    }

    const unlockAudio = () => {
      const audioContext = getAudioContext()
      if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {})
    }

    const playToastSound = (toast) => {
      if (playedToastsRef.current.has(toast)) return
      playedToastsRef.current.add(toast)

      const audioContext = getAudioContext()
      if (!audioContext || audioContext.state !== 'running') return

      const now = audioContext.currentTime
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(toastTone(toast), now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.12)
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
      observer.disconnect()
      window.removeEventListener('pointerdown', unlockAudio, { capture: true })
      window.removeEventListener('keydown', unlockAudio, { capture: true })
      audioContextRef.current?.close().catch(() => {})
      audioContextRef.current = null
    }
  }, [])

  return null
}
