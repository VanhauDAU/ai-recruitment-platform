import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PcmStreamPlayer } from './pcm-stream-player'

const RATE = 8_000

class FakeAudioParam {
  constructor(value) {
    this.value = value
    this.events = []
  }

  cancelScheduledValues(time) {
    this.events.push(['cancel', time])
  }

  setValueAtTime(value, time) {
    this.events.push(['set', value, time])
  }

  linearRampToValueAtTime(value, time) {
    this.events.push(['ramp', value, time])
  }
}

class FakeAudioContext {
  constructor({ sampleRate = 48_000 } = {}) {
    this.currentTime = 0
    this.destination = {}
    this.sources = []
    this.state = 'suspended'
    this.sampleRate = sampleRate
  }

  close() {
    this.state = 'closed'
  }

  createBuffer(_channels, length, sampleRate) {
    return {
      duration: length / sampleRate,
      copyToChannel(samples) {
        this.samples = samples
      },
    }
  }

  createBufferSource() {
    const source = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      playbackRate: { value: 1 },
      start: vi.fn(),
      stop: vi.fn(),
    }
    this.sources.push(source)
    return source
  }

  createGain() {
    return { connect: vi.fn(), gain: new FakeAudioParam(1) }
  }

  resume() {
    this.state = 'running'
    return Promise.resolve()
  }

  suspend() {
    this.state = 'suspended'
    return Promise.resolve()
  }
}

function wavHeader({ sampleRate = RATE, extraChunk = false } = {}) {
  const bytes = new Uint8Array(36 + (extraChunk ? 12 : 0) + 8)
  const view = new DataView(bytes.buffer)
  const ascii = (offset, text) => {
    for (let index = 0; index < 4; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 0xFFFFFFFF, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  let offset = 36
  if (extraChunk) {
    ascii(offset, 'LIST')
    view.setUint32(offset + 4, 4, true)
    offset += 12
  }
  ascii(offset, 'data')
  view.setUint32(offset + 4, 0xFFFFFFFF, true)
  return bytes
}

function pcmSeconds(seconds, sampleRate = RATE) {
  return new Uint8Array(Math.round(seconds * sampleRate) * 2)
}

function streamResponse(chunks) {
  let index = 0
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => (
          index < chunks.length
            ? { done: false, value: chunks[index++] }
            : { done: true, value: undefined }
        ),
      }),
    },
  }
}

/** Reader do test điều khiển, để giữ luồng mở và mô phỏng nguồn về trễ. */
function controllableResponse() {
  const pending = []
  let resolveNext = null
  const push = (value) => {
    if (resolveNext) {
      const resolve = resolveNext
      resolveNext = null
      resolve({ done: false, value })
    } else pending.push({ done: false, value })
  }
  return {
    push,
    close: () => push(undefined) || (pending.push({ done: true, value: undefined })),
    response: {
      ok: true,
      body: {
        getReader: () => ({
          read: () => (
            pending.length
              ? Promise.resolve(pending.shift())
              : new Promise((resolve) => { resolveNext = resolve })
          ),
        }),
      },
    },
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('PcmStreamPlayer', () => {
  beforeEach(() => {
    window.AudioContext = FakeAudioContext
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.AudioContext
  })

  it('plays PCM when the WAV header and samples split at odd byte boundaries', async () => {
    const header = wavHeader()
    const pcm = new Uint8Array([0, 0, 255, 127, 0, 128])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([
      header.subarray(0, header.length - 1),
      new Uint8Array([header[header.length - 1], pcm[0], pcm[1], pcm[2]]),
      pcm.subarray(3),
    ])))
    const callbacks = { onEnded: vi.fn(), onError: vi.fn(), onFirstAudio: vi.fn(), onTimeUpdate: vi.fn() }
    const player = new PcmStreamPlayer(callbacks)

    await player.play('/tts/v1/streams/token', { rate: 1.25, sampleRate: RATE })

    expect(callbacks.onError).not.toHaveBeenCalled()
    expect(callbacks.onFirstAudio).toHaveBeenCalledTimes(1)
    // Luồng đã đóng nên phần dư được gộp thành một khối liên tục, không còn
    // mỗi mẩu mạng một source như trước.
    expect(player.context.sources).toHaveLength(1)
    expect(player.context.sources[0].playbackRate.value).toBe(1.25)
    expect(player.context.sources[0].buffer.samples).toHaveLength(3)

    player.context.currentTime = 5
    player.pump()
    expect(callbacks.onEnded).toHaveBeenCalledTimes(1)
    player.destroy()
  })

  it('accepts a header that carries an extra chunk before data', async () => {
    const pcm = new Uint8Array([0, 0, 255, 127])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([
      wavHeader({ extraChunk: true }),
      pcm,
    ])))
    const callbacks = { onEnded: vi.fn(), onError: vi.fn(), onFirstAudio: vi.fn() }
    const player = new PcmStreamPlayer(callbacks)

    await player.play('/tts/v1/streams/token', { sampleRate: RATE })

    expect(callbacks.onError).not.toHaveBeenCalled()
    expect(player.context.sources[0].buffer.samples).toHaveLength(2)
    player.destroy()
  })

  it('holds the first block until the jitter buffer is filled', async () => {
    const stream = controllableResponse()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response))
    const callbacks = { onEnded: vi.fn(), onError: vi.fn(), onFirstAudio: vi.fn() }
    const player = new PcmStreamPlayer(callbacks)

    player.play('/tts/v1/streams/token', { sampleRate: RATE })
    stream.push(wavHeader())
    stream.push(pcmSeconds(0.3))
    await flush()
    player.pump()

    // Nguồn mới gửi 0.3s: phát ngay là chắc chắn hụt tiếng khi cụm sau về trễ.
    expect(player.context.sources).toHaveLength(0)
    expect(callbacks.onFirstAudio).not.toHaveBeenCalled()

    stream.push(pcmSeconds(1.2))
    await flush()
    player.pump()

    expect(callbacks.onFirstAudio).toHaveBeenCalledTimes(1)
    expect(player.context.sources.length).toBeGreaterThan(0)
    player.destroy()
  })

  it('fades out and reports rebuffering when the source starves mid-playback', async () => {
    const stream = controllableResponse()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response))
    const callbacks = { onEnded: vi.fn(), onError: vi.fn(), onFirstAudio: vi.fn(), onRebuffering: vi.fn() }
    const player = new PcmStreamPlayer(callbacks)

    player.play('/tts/v1/streams/token', { sampleRate: RATE })
    stream.push(wavHeader())
    stream.push(pcmSeconds(1.5))
    await flush()
    player.pump()
    expect(callbacks.onFirstAudio).toHaveBeenCalledTimes(1)

    // Toàn bộ audio đã lên lịch đã phát hết mà cụm kế tiếp chưa về.
    player.context.currentTime = player.nextStartAt + 2
    player.pump()

    expect(callbacks.onRebuffering).toHaveBeenCalledWith(true)
    expect(callbacks.onEnded).not.toHaveBeenCalled()
    expect(player.gain.gain.events.some(([kind, value]) => kind === 'ramp' && value === 0)).toBe(true)

    stream.push(pcmSeconds(1.2))
    await flush()
    player.pump()

    expect(callbacks.onRebuffering).toHaveBeenLastCalledWith(false)
    player.destroy()
  })

  it('reports a malformed WAV header without leaving playback active', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([new Uint8Array(12)])))
    const onError = vi.fn()
    const player = new PcmStreamPlayer({ onError })

    await expect(player.play('/tts/v1/streams/token')).rejects.toThrow('Luồng WAV không hợp lệ.')

    expect(onError).toHaveBeenCalledTimes(1)
    expect(player.sources.size).toBe(0)
    player.destroy()
  })

  it('surfaces the retry hint when the service is busy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (name) => (name === 'Retry-After' ? '3' : null) },
      json: async () => ({ detail: 'The speech engine is busy.' }),
    }))
    const player = new PcmStreamPlayer({ onError: vi.fn() })

    await expect(player.play('/tts/v1/streams/token')).rejects.toMatchObject({
      status: 429,
      retryAfter: 3,
    })
    player.destroy()
  })
})
