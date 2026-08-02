import {
  DEFAULT_SAMPLE_RATE,
  audioContextConstructor,
  initialBufferSeconds,
  mergeBytes,
  parseWavHeader,
  pcm16ToFloat32,
  responseError,
} from './pcm-stream-format'

const BLOCK_SECONDS = 0.25
const SCHEDULE_AHEAD_SECONDS = 0.75
const PUMP_INTERVAL_MS = 60
const FADE_SECONDS = 0.006
const ANCHOR_LEAD_SECONDS = 0.08
const MAX_QUEUE_SECONDS = 30
const RESUME_QUEUE_SECONDS = 20
const MAX_ENQUEUE_SECONDS = 1

/**
 * Phát PCM16 WAV trực tiếp bằng Web Audio. Cách này không phụ thuộc browser
 * đoán duration của WAV chunked và giữ AudioContext được mở ngay trong click
 * gesture, nên ổn định hơn HTMLAudioElement cho luồng chưa biết độ dài.
 *
 * Sample đến từ mạng được gom vào hàng đợi rồi mới lên lịch phát theo khối đều
 * nhau, thay vì phát thẳng từng mẩu vừa nhận: nguồn sinh có nhịp không đều nên
 * lên lịch trực tiếp sẽ thủng tiếng mỗi lần cụm sau về trễ.
 */
export class PcmStreamPlayer {
  constructor({ onEnded, onError, onFirstAudio, onRebuffering, onTimeUpdate }) {
    this.callbacks = { onEnded, onError, onFirstAudio, onRebuffering, onTimeUpdate }
    this.context = null
    this.gain = null
    this.sampleRate = DEFAULT_SAMPLE_RATE
    this.queue = []
    this.queuedSamples = 0
    this.sources = new Set()
    this.nextStartAt = null
    this.playedSeconds = 0
    this.anchorAt = null
    this.streamComplete = false
    this.started = false
    this.rebuffering = false
    this.rate = 1
    this.prebufferSeconds = 0.48
    this.rebufferSeconds = 0.75
    this.pumpTimer = null
    this.progressTimer = null
    this.generation = 0
  }

  unlock(sampleRate = DEFAULT_SAMPLE_RATE) {
    const Context = audioContextConstructor()
    if (!Context) throw new Error('Trình duyệt này chưa hỗ trợ Web Audio.')
    // Khớp sample rate của context với luồng để Chrome resample một lần ở đầu
    // ra thiết bị. Nếu để lệch (thiết bị 44.1kHz, buffer 48kHz), mỗi AudioBuffer
    // bị resample độc lập và biên giữa các khối kêu lụp bụp.
    if (this.context && this.context.state !== 'closed' && this.context.sampleRate !== sampleRate) {
      this.context.close()
      this.context = null
    }
    if (!this.context || this.context.state === 'closed') {
      this.context = new Context({ latencyHint: 'playback', sampleRate })
      this.gain = this.context.createGain()
      this.gain.connect(this.context.destination)
      this.sampleRate = this.context.sampleRate
    }
    return this.context.resume()
  }

  async play(streamUrl, {
    cached = false,
    signal,
    rate = 1,
    sampleRate = DEFAULT_SAMPLE_RATE,
  } = {}) {
    this.reset()
    await this.unlock(sampleRate)
    this.rate = rate
    this.prebufferSeconds = initialBufferSeconds({ cached, rate })
    this.rebufferSeconds = Math.min(1.2, Math.max(cached ? 0.45 : 0.75, this.prebufferSeconds * 1.5))
    const generation = this.generation
    const response = await fetch(streamUrl, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal,
    })
    if (!response.ok) throw await responseError(response)
    if (!response.body) throw new Error('Trình duyệt không hỗ trợ phát âm thanh trực tiếp.')

    const reader = response.body.getReader()
    let header = null
    let carry = new Uint8Array()
    this.startPump()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (generation !== this.generation) return
        let bytes = value

        if (!header) {
          carry = mergeBytes(carry, bytes)
          header = parseWavHeader(carry)
          if (!header) {
            if (carry.byteLength > 4096) throw new Error('Luồng WAV không hợp lệ.')
            continue
          }
          bytes = carry.subarray(header.dataOffset)
          carry = new Uint8Array()
          if (header.sampleRate !== this.sampleRate) this.sampleRate = header.sampleRate
        }
        if (!bytes.byteLength) continue

        const merged = mergeBytes(carry, bytes)
        const evenLength = merged.byteLength - (merged.byteLength % 2)
        if (evenLength) {
          const enqueued = await this.enqueueWithBackpressure(
            merged.subarray(0, evenLength),
            generation,
            signal,
          )
          if (!enqueued) return
        }
        carry = evenLength < merged.byteLength ? merged.slice(evenLength) : new Uint8Array()
      }
      if (!header) throw new Error('Luồng WAV không hợp lệ.')
      this.streamComplete = true
      this.pump()
    } catch (error) {
      if (error.name !== 'AbortError' && generation === this.generation) {
        this.stopPump()
        this.callbacks.onError?.(error)
      }
      throw error
    }
  }

  enqueue(bytes) {
    const samples = pcm16ToFloat32(bytes)
    this.queue.push(samples)
    this.queuedSamples += samples.length
  }

  async enqueueWithBackpressure(bytes, generation, signal) {
    const maxChunkBytes = Math.round(MAX_ENQUEUE_SECONDS * this.sampleRate) * 2
    for (let offset = 0; offset < bytes.byteLength; offset += maxChunkBytes) {
      while (this.queuedSeconds() >= MAX_QUEUE_SECONDS) {
        if (generation !== this.generation || signal?.aborted) return false
        await new Promise((resolve) => window.setTimeout(resolve, PUMP_INTERVAL_MS))
        if (this.queuedSeconds() <= RESUME_QUEUE_SECONDS) break
      }
      if (generation !== this.generation || signal?.aborted) return false
      this.enqueue(bytes.subarray(offset, Math.min(offset + maxChunkBytes, bytes.byteLength)))
    }
    return true
  }

  /** Gộp/cắt hàng đợi thành đúng `count` sample liên tục. */
  take(count) {
    const block = new Float32Array(count)
    let filled = 0
    while (filled < count && this.queue.length) {
      const head = this.queue[0]
      const size = Math.min(head.length, count - filled)
      block.set(size === head.length ? head : head.subarray(0, size), filled)
      filled += size
      if (size === head.length) this.queue.shift()
      else this.queue[0] = head.subarray(size)
    }
    this.queuedSamples -= filled
    return block
  }

  startPump() {
    this.stopPump()
    this.pumpTimer = window.setInterval(() => this.pump(), PUMP_INTERVAL_MS)
  }

  stopPump() {
    if (this.pumpTimer !== null) window.clearInterval(this.pumpTimer)
    this.pumpTimer = null
  }

  queuedSeconds() {
    return this.queuedSamples / this.sampleRate
  }

  pump() {
    if (!this.context || !this.gain) return
    const now = this.context.currentTime

    if (!this.started || this.rebuffering) {
      const needed = this.started ? this.rebufferSeconds : this.prebufferSeconds
      // Luồng đã hết thì phát nốt phần còn lại thay vì chờ đủ đệm.
      if (this.queuedSeconds() < needed && !this.streamComplete) return
      if (!this.queuedSamples) {
        if (this.streamComplete) this.finish()
        return
      }
      this.anchor(now)
    }

    while (
      this.queuedSamples
      && this.nextStartAt !== null
      && this.nextStartAt < now + SCHEDULE_AHEAD_SECONDS
    ) {
      const block = Math.round(BLOCK_SECONDS * this.sampleRate)
      // Chờ đủ một khối trọn vẹn, trừ khi đã hết luồng: cắt khối nhỏ lẻ giữa
      // chừng tạo thêm biên nối không cần thiết.
      if (this.queuedSamples < block && !this.streamComplete) break
      this.scheduleBlock(this.take(Math.min(block, this.queuedSamples)))
    }

    if (this.nextStartAt === null) return
    if (this.queuedSamples || !this.streamComplete) {
      this.guardUnderrun(now)
      return
    }
    if (now + 0.01 >= this.nextStartAt) this.finish()
  }

  /** Đặt mốc phát mới và mở tiếng bằng fade ngắn để không nghe tiếng "tách". */
  anchor(now) {
    this.nextStartAt = now + ANCHOR_LEAD_SECONDS
    this.anchorAt = this.nextStartAt
    this.gain.gain.cancelScheduledValues(now)
    this.gain.gain.setValueAtTime(0, this.nextStartAt)
    this.gain.gain.linearRampToValueAtTime(1, this.nextStartAt + FADE_SECONDS)
    if (!this.started) {
      this.started = true
      this.callbacks.onFirstAudio?.()
      this.startProgressTimer()
    }
    if (this.rebuffering) {
      this.rebuffering = false
      this.callbacks.onRebuffering?.(false)
    }
  }

  scheduleBlock(samples) {
    const buffer = this.context.createBuffer(1, samples.length, this.sampleRate)
    buffer.copyToChannel(samples, 0)
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = this.rate
    source.connect(this.gain)
    source.start(this.nextStartAt)
    this.nextStartAt += buffer.duration / this.rate
    this.sources.add(source)
    source.onended = () => {
      this.sources.delete(source)
      source.disconnect()
    }
  }

  /**
   * Hàng đợi cạn trước khi cụm kế tiếp về. Đóng tiếng ngay tại mốc audio cuối
   * cùng đã lên lịch để chỗ thủng thành khoảng lặng sạch, rồi chờ đệm lại.
   */
  guardUnderrun(now) {
    if (this.rebuffering || this.queuedSamples) return
    if (this.nextStartAt > now + PUMP_INTERVAL_MS / 1000 + FADE_SECONDS) return
    const fadeFrom = Math.max(now, this.nextStartAt - FADE_SECONDS)
    this.gain.gain.cancelScheduledValues(fadeFrom)
    this.gain.gain.setValueAtTime(this.gain.gain.value, fadeFrom)
    this.gain.gain.linearRampToValueAtTime(0, this.nextStartAt)
    this.playedSeconds = this.elapsed()
    this.anchorAt = null
    this.nextStartAt = null
    this.rebuffering = true
    this.callbacks.onRebuffering?.(true)
  }

  finish() {
    this.stopPump()
    this.stopProgressTimer()
    this.playedSeconds = this.elapsed()
    this.anchorAt = null
    this.callbacks.onTimeUpdate?.(this.playedSeconds)
    this.callbacks.onEnded?.()
  }

  pause() {
    if (this.context?.state === 'running') this.context.suspend()
  }

  resume() {
    if (this.context?.state === 'suspended') this.context.resume()
  }

  setRate(rate) {
    const nextRate = Number(rate)
    if (!Number.isFinite(nextRate) || nextRate <= 0 || nextRate === this.rate) return
    // Những block đã lên lịch (tối đa 0.75s) giữ nhịp cũ để không tạo khe/hụt
    // tiếng; block kế tiếp dùng tốc độ mới mà không cần tải hay sinh lại audio.
    this.playedSeconds = this.elapsed()
    if (this.anchorAt !== null && this.context) this.anchorAt = this.context.currentTime
    this.rate = nextRate
  }

  elapsed() {
    if (!this.context || this.anchorAt === null) return this.playedSeconds
    return this.playedSeconds + Math.max(0, (this.context.currentTime - this.anchorAt) * this.rate)
  }

  reset() {
    this.generation += 1
    for (const source of this.sources) {
      try {
        source.stop()
      } catch {
        // Source đã kết thúc giữa lúc reset.
      }
      source.disconnect()
    }
    this.sources.clear()
    this.queue = []
    this.queuedSamples = 0
    this.nextStartAt = null
    this.anchorAt = null
    this.playedSeconds = 0
    this.streamComplete = false
    this.started = false
    this.rebuffering = false
    if (this.gain && this.context) {
      this.gain.gain.cancelScheduledValues(this.context.currentTime)
      this.gain.gain.setValueAtTime(1, this.context.currentTime)
    }
    this.stopPump()
    this.stopProgressTimer()
  }

  destroy() {
    this.reset()
    this.context?.close()
    this.context = null
    this.gain = null
  }

  startProgressTimer() {
    this.stopProgressTimer()
    this.progressTimer = window.setInterval(() => {
      this.callbacks.onTimeUpdate?.(this.elapsed())
    }, 250)
  }

  stopProgressTimer() {
    if (this.progressTimer !== null) window.clearInterval(this.progressTimer)
    this.progressTimer = null
  }
}
