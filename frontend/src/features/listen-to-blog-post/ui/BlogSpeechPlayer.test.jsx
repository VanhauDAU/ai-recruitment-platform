import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlogSpeechSession } from '@/entities/speech'
import BlogSpeechPlayer from './BlogSpeechPlayer'

const { pcm, siteSettings } = vi.hoisted(() => ({
  pcm: { callbacks: null, play: vi.fn(), reset: vi.fn(), setRate: vi.fn() },
  siteSettings: { speech_blog_enabled: true },
}))
const nativeAudio = { instances: [] }

class FakeAudio {
  constructor() {
    this.currentTime = 0
    this.duration = 120
    this.listeners = new Map()
    this.load = vi.fn()
    this.pause = vi.fn()
    this.play = vi.fn(async () => this.emit('playing'))
    this.playbackRate = 1
    this.preload = 'none'
    this.removeAttribute = vi.fn()
    this.src = ''
    nativeAudio.instances.push(this)
  }

  addEventListener(event, listener) {
    this.listeners.set(event, listener)
  }

  removeEventListener(event, listener) {
    if (this.listeners.get(event) === listener) this.listeners.delete(event)
  }

  emit(event) {
    this.listeners.get(event)?.()
  }
}

vi.mock('@/entities/site-settings', () => ({
  useSiteSettings: () => ({ settings: siteSettings }),
}))

vi.mock('@/entities/speech', () => ({ createBlogSpeechSession: vi.fn() }))

vi.mock('@/shared/lib/speech/pcm-stream-player', () => ({
  PcmStreamPlayer: class {
    constructor(callbacks) {
      pcm.callbacks = callbacks
    }

    unlock() {}
    reset() { pcm.reset() }
    async play(...args) { return pcm.play(...args) }
    pause() {}
    resume() {}
    setRate(value) { pcm.setRate(value) }
    destroy() {}
  },
}))

const defaultAsset = {
  status: 'ready',
  url: '/media/speech/blog/default-asset.mp3',
  voice_id: 'north-male-natural',
  style: 'tu_nhien',
  mime_type: 'audio/mpeg',
  duration_ms: 120_000,
}

describe('BlogSpeechPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nativeAudio.instances = []
    siteSettings.speech_blog_enabled = true
    vi.stubGlobal('Audio', FakeAudio)
    window.localStorage.clear()
    pcm.play.mockImplementation(async () => pcm.callbacks.onFirstAudio())
    createBlogSpeechSession.mockResolvedValue({
      stream_url: '/tts/v1/streams/opaque-token-value-123456',
      voice_id: 'north-male-natural',
      style: 'tu_nhien',
      cached: false,
      truncated: false,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete navigator.connection
  })

  it('renders nothing and makes no request when the public policy is off', () => {
    siteSettings.speech_blog_enabled = false

    const { container } = render(<BlogSpeechPlayer postPublicId="ps_article" />)

    expect(container).toBeEmptyDOMElement()
    expect(createBlogSpeechSession).not.toHaveBeenCalled()
  })

  it('does not contact TTS during article render', () => {
    render(<BlogSpeechPlayer postPublicId="ps_article" />)

    expect(screen.getByRole('button', { name: 'Phát bài viết ngay' })).toBeInTheDocument()
    expect(createBlogSpeechSession).not.toHaveBeenCalled()
  })

  it('starts a server-controlled blog voice with one click', async () => {
    render(<BlogSpeechPlayer postPublicId="ps_article" />)

    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))

    await waitFor(() => expect(createBlogSpeechSession).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      sourcePublicId: 'ps_article',
    }))
    expect(pcm.play).toHaveBeenCalled()
    expect(screen.queryByLabelText('Giọng đọc')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Phong cách đọc')).not.toBeInTheDocument()
  })

  it('plays an existing durable asset without creating a session', async () => {
    render(<BlogSpeechPlayer defaultAsset={defaultAsset} postPublicId="ps_article" />)

    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))

    expect(await screen.findByRole('button', { name: 'Đang đọc. Bấm để tùy chỉnh' })).toBeInTheDocument()
    expect(nativeAudio.instances[0].src).toBe(defaultAsset.url)
    expect(createBlogSpeechSession).not.toHaveBeenCalled()
  })

  it('changes playback speed locally without requesting another artifact', async () => {
    render(<BlogSpeechPlayer defaultAsset={defaultAsset} postPublicId="ps_article" />)
    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))
    await screen.findByRole('button', { name: 'Đang đọc. Bấm để tùy chỉnh' })

    fireEvent.click(screen.getByRole('button', { name: 'Đang đọc. Bấm để tùy chỉnh' }))
    fireEvent.change(await screen.findByLabelText('Tốc độ phát'), { target: { value: '1.25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng và phát' }))

    expect(nativeAudio.instances[0].playbackRate).toBe(1.25)
    expect(createBlogSpeechSession).not.toHaveBeenCalled()
  })

  it('keeps the text experience intact when synthesis is unavailable', async () => {
    createBlogSpeechSession.mockRejectedValue({
      response: { data: { detail: 'Dịch vụ chưa sẵn sàng.' } },
    })
    render(<BlogSpeechPlayer postPublicId="ps_article" />)

    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Dịch vụ chưa sẵn sàng.')
    expect(screen.getByRole('button', { name: 'Thử phát lại' })).toBeInTheDocument()
  })

  it('preloads a durable asset outside the initial render path', () => {
    let idleCallback
    vi.stubGlobal('requestIdleCallback', vi.fn((callback) => {
      idleCallback = callback
      return 7
    }))
    vi.stubGlobal('cancelIdleCallback', vi.fn())
    render(<BlogSpeechPlayer defaultAsset={defaultAsset} postPublicId="ps_article" />)

    expect(nativeAudio.instances).toHaveLength(0)
    act(() => idleCallback())
    expect(nativeAudio.instances).toHaveLength(1)
  })
})
