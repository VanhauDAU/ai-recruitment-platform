/**
 * Player for a stable, pre-generated audio asset. Native media playback gives
 * us browser HTTP caching, range requests and resilient platform buffering.
 */
export class NativeAudioPlayer {
  constructor(callbacks) {
    this.callbacks = callbacks
    this.audio = null
    this.url = ''
    this.active = false
    this.firstAudioReported = false
    this.cleanupListeners = null
  }

  ensure(url, { preload = false } = {}) {
    if (this.audio && this.url === url) {
      if (preload && this.audio.preload !== 'auto') {
        this.audio.preload = 'auto'
        this.audio.load?.()
      }
      return this.audio
    }

    this.release()
    const audio = new window.Audio()
    audio.preload = preload ? 'auto' : 'none'
    audio.playsInline = true
    audio.src = url

    const listeners = {
      ended: () => {
        if (!this.active) return
        this.callbacks.onTimeUpdate?.(Number(audio.duration) || Number(audio.currentTime) || 0)
        this.callbacks.onEnded?.()
      },
      error: () => this.active && this.callbacks.onError?.(),
      playing: () => {
        if (!this.active) return
        if (!this.firstAudioReported) {
          this.firstAudioReported = true
          this.callbacks.onFirstAudio?.()
        } else {
          this.callbacks.onResumed?.()
        }
      },
      timeupdate: () => {
        if (this.active) this.callbacks.onTimeUpdate?.(Number(audio.currentTime) || 0)
      },
      waiting: () => this.active && this.callbacks.onRebuffering?.(),
    }
    Object.entries(listeners).forEach(([event, listener]) => audio.addEventListener(event, listener))
    this.cleanupListeners = () => {
      Object.entries(listeners).forEach(([event, listener]) => audio.removeEventListener(event, listener))
    }
    this.audio = audio
    this.url = url
    return audio
  }

  preload(url) {
    this.ensure(url, { preload: true })
  }

  play(url, { rate = 1 } = {}) {
    const audio = this.ensure(url, { preload: true })
    this.active = true
    this.firstAudioReported = false
    audio.playbackRate = rate
    return audio.play()
  }

  pause() {
    this.audio?.pause()
  }

  resume() {
    return this.audio?.play() || Promise.resolve()
  }

  setRate(rate) {
    if (this.audio) this.audio.playbackRate = rate
  }

  reset() {
    this.active = false
    this.firstAudioReported = false
    if (!this.audio) return
    this.audio.pause()
    try {
      this.audio.currentTime = 0
    } catch {
      // A not-yet-loaded media element may reject seeking; playback still resets.
    }
  }

  release() {
    this.reset()
    this.cleanupListeners?.()
    this.cleanupListeners = null
    if (this.audio) {
      this.audio.removeAttribute('src')
      this.audio.load?.()
    }
    this.audio = null
    this.url = ''
  }
}
