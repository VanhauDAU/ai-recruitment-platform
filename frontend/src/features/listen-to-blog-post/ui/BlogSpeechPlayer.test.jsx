import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlogSpeechSession, getSpeechVoiceCatalog } from '@/entities/speech'
import BlogSpeechPlayer from './BlogSpeechPlayer'

const pcm = vi.hoisted(() => ({
  callbacks: null,
  play: vi.fn(),
  reset: vi.fn(),
  setRate: vi.fn(),
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

vi.mock('@/entities/speech', () => ({
  createBlogSpeechSession: vi.fn(),
  getSpeechVoiceCatalog: vi.fn(),
}))

vi.mock('../model/pcm-stream-player', () => ({
  PcmStreamPlayer: class {
    constructor(callbacks) {
      pcm.callbacks = callbacks
    }

    unlock() {}

    reset() {
      pcm.reset()
    }

    async play(...args) {
      return pcm.play(...args)
    }

    pause() {}

    resume() {}

    setRate(value) {
      pcm.setRate(value)
    }

    destroy() {}
  },
}))

const catalog = {
  default_voice_id: 'north-male-natural',
  voices: [
    { id: 'north-male-natural', label: 'Phạm Tuyên', gender: 'male', region: 'Bắc', default_style: 'tu_nhien' },
    { id: 'south-female-news', label: 'Thùy Dung', gender: 'female', region: 'Nam', default_style: 'tin_tuc' },
  ],
  styles: [
    { id: 'tu_nhien', label: 'Tự nhiên' },
    { id: 'tin_tuc', label: 'Rõ ràng' },
  ],
}

const defaultAsset = {
  status: 'ready',
  url: '/media/speech/blog/default-asset.mp3',
  voice_id: 'north-male-natural',
  style: 'tu_nhien',
  mime_type: 'audio/mpeg',
  duration_ms: 120_000,
}

const customAsset = {
  ...defaultAsset,
  url: '/media/speech/blog/custom-asset.mp3',
  voice_id: 'south-female-news',
  style: 'tin_tuc',
}

describe('BlogSpeechPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nativeAudio.instances = []
    vi.stubGlobal('Audio', FakeAudio)
    window.localStorage.clear()
    pcm.play.mockImplementation(async () => pcm.callbacks.onFirstAudio())
    getSpeechVoiceCatalog.mockResolvedValue(catalog)
    createBlogSpeechSession.mockResolvedValue({
      stream_url: '/tts/v1/streams/opaque-token-value-123456',
      voice_id: 'north-male-natural',
      style: 'tu_nhien',
      cached: false,
      truncated: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete navigator.connection
  })

  it('does not contact TTS during initial article render', () => {
    render(<BlogSpeechPlayer postPublicId="ps_article" />)

    expect(screen.getByRole('button', { name: 'Phát bài viết ngay' })).toBeInTheDocument()
    expect(getSpeechVoiceCatalog).not.toHaveBeenCalled()
    expect(createBlogSpeechSession).not.toHaveBeenCalled()
  })

  it('starts the default voice with one click and no catalog round trip', async () => {
    render(
      <StrictMode>
        <BlogSpeechPlayer postPublicId="ps_article" />
      </StrictMode>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))

    await waitFor(() => expect(createBlogSpeechSession).toHaveBeenCalledWith(expect.objectContaining({
      sourcePublicId: 'ps_article',
      style: '',
      voiceId: '',
    })))
    expect(getSpeechVoiceCatalog).not.toHaveBeenCalled()
    expect(pcm.play).toHaveBeenCalledWith(
      '/tts/v1/streams/opaque-token-value-123456',
      expect.objectContaining({ rate: 1 }),
    )
    expect(screen.getByRole('button', { name: 'Đang đọc. Bấm để tùy chỉnh' })).toBeInTheDocument()
  })

  it('plays a prepared default asset directly without creating a TTS session', async () => {
    render(<BlogSpeechPlayer defaultAsset={defaultAsset} postPublicId="ps_article" />)

    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))

    expect(await screen.findByRole('button', { name: 'Đang đọc. Bấm để tùy chỉnh' })).toBeInTheDocument()
    expect(nativeAudio.instances).toHaveLength(1)
    expect(nativeAudio.instances[0].src).toBe(defaultAsset.url)
    expect(nativeAudio.instances[0].preload).toBe('auto')
    expect(nativeAudio.instances[0].play).toHaveBeenCalledTimes(1)
    expect(createBlogSpeechSession).not.toHaveBeenCalled()
    expect(pcm.play).not.toHaveBeenCalled()
  })

  it('falls back to live PCM when the stored voice does not match the prepared asset', async () => {
    window.localStorage.setItem('procv_blog_speech_voice_v1', 'south-female-news')
    window.localStorage.setItem('procv_blog_speech_style_v1', 'tin_tuc')
    render(<BlogSpeechPlayer defaultAsset={defaultAsset} postPublicId="ps_article" />)

    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))

    await waitFor(() => expect(createBlogSpeechSession).toHaveBeenCalledWith(expect.objectContaining({
      style: 'tin_tuc',
      voiceId: 'south-female-news',
    })))
    expect(pcm.play).toHaveBeenCalledTimes(1)
    expect(nativeAudio.instances).toHaveLength(0)
  })

  it('reuses a custom voice artifact created by an earlier listener', async () => {
    window.localStorage.setItem('procv_blog_speech_voice_v1', 'south-female-news')
    window.localStorage.setItem('procv_blog_speech_style_v1', 'tin_tuc')
    render(
      <BlogSpeechPlayer
        defaultAsset={defaultAsset}
        postPublicId="ps_article"
        preparedAssets={[defaultAsset, customAsset]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))

    expect(await screen.findByRole('button', { name: 'Đang đọc. Bấm để tùy chỉnh' })).toBeInTheDocument()
    expect(nativeAudio.instances[0].src).toBe(customAsset.url)
    expect(createBlogSpeechSession).not.toHaveBeenCalled()
    expect(pcm.play).not.toHaveBeenCalled()
  })

  it('does not treat a custom artifact as the implicit server default', async () => {
    render(
      <BlogSpeechPlayer
        postPublicId="ps_article"
        preparedAssets={[customAsset]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))

    await waitFor(() => expect(createBlogSpeechSession).toHaveBeenCalledTimes(1))
    expect(pcm.play).toHaveBeenCalledTimes(1)
    expect(nativeAudio.instances).toHaveLength(0)
  })

  it('preloads only after idle and skips preload for data-saving connections', () => {
    let idleCallback
    vi.stubGlobal('requestIdleCallback', vi.fn((callback) => {
      idleCallback = callback
      return 7
    }))
    vi.stubGlobal('cancelIdleCallback', vi.fn())
    const { unmount } = render(
      <BlogSpeechPlayer defaultAsset={defaultAsset} postPublicId="ps_article" />,
    )

    expect(nativeAudio.instances).toHaveLength(0)
    act(() => idleCallback())
    expect(nativeAudio.instances).toHaveLength(1)
    unmount()

    nativeAudio.instances = []
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '4g', saveData: true },
    })
    render(<BlogSpeechPlayer defaultAsset={defaultAsset} postPublicId="ps_article-2" />)
    act(() => idleCallback())
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Phát bài viết ngay' }))
    expect(nativeAudio.instances).toHaveLength(0)
  })

  it('changes playback speed locally when voice and style stay unchanged', async () => {
    render(<BlogSpeechPlayer defaultAsset={defaultAsset} postPublicId="ps_article" />)
    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))
    await screen.findByRole('button', { name: 'Đang đọc. Bấm để tùy chỉnh' })

    fireEvent.click(screen.getByRole('button', { name: 'Đang đọc. Bấm để tùy chỉnh' }))
    await screen.findByLabelText('Tốc độ phát')
    fireEvent.change(screen.getByLabelText('Tốc độ phát'), { target: { value: '1.25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng và phát' }))

    expect(nativeAudio.instances[0].playbackRate).toBe(1.25)
    expect(nativeAudio.instances[0].play).toHaveBeenCalledTimes(1)
    expect(createBlogSpeechSession).not.toHaveBeenCalled()
  })

  it('shows a cancel action while queued and aborts further retries', async () => {
    pcm.play.mockRejectedValue({ status: 503, retryAfter: 4 })
    render(<BlogSpeechPlayer postPublicId="ps_article" />)
    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))

    await screen.findByRole('button', { name: 'Đang chuẩn bị giọng đọc' })
    fireEvent.click(screen.getByRole('button', { name: 'Đang chuẩn bị giọng đọc' }))
    expect(await screen.findByText('Đang xếp hàng chờ giọng đọc…')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy chờ giọng đọc' }))

    expect(await screen.findByRole('button', { name: 'Phát bài viết ngay' })).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(pcm.play).toHaveBeenCalledTimes(1)
  })

  it('opens voice settings after playback has ended instead of restarting immediately', async () => {
    render(<BlogSpeechPlayer postPublicId="ps_article" />)
    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))
    await screen.findByRole('button', { name: 'Đang đọc. Bấm để tùy chỉnh' })

    act(() => pcm.callbacks.onEnded())
    fireEvent.click(screen.getByRole('button', { name: 'Đã đọc xong. Bấm để tùy chỉnh' }))

    expect(await screen.findByRole('dialog', { name: 'Tùy chỉnh giọng đọc' })).toBeInTheDocument()
    expect(createBlogSpeechSession).toHaveBeenCalledTimes(1)
    expect(getSpeechVoiceCatalog).toHaveBeenCalledTimes(1)
  })

  it('loads advanced choices only on the second click and applies another voice', async () => {
    render(<BlogSpeechPlayer postPublicId="ps_article" />)
    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))
    await screen.findByRole('button', { name: 'Đang đọc. Bấm để tùy chỉnh' })

    fireEvent.click(screen.getByRole('button', { name: 'Đang đọc. Bấm để tùy chỉnh' }))
    expect(await screen.findByRole('dialog', { name: 'Tùy chỉnh giọng đọc' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Giọng đọc')).toHaveValue('north-male-natural')
    fireEvent.change(screen.getByLabelText('Giọng đọc'), { target: { value: 'south-female-news' } })
    fireEvent.change(screen.getByLabelText('Phong cách đọc'), { target: { value: 'tin_tuc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng và phát' }))

    await waitFor(() => expect(createBlogSpeechSession).toHaveBeenLastCalledWith(expect.objectContaining({
      voiceId: 'south-female-news',
      style: 'tin_tuc',
    })))
  })

  it('keeps a compact retry panel when the local service is unavailable', async () => {
    createBlogSpeechSession.mockRejectedValue({
      response: { data: { detail: 'Dịch vụ chưa sẵn sàng.' } },
    })
    render(<BlogSpeechPlayer postPublicId="ps_article" />)

    fireEvent.click(screen.getByRole('button', { name: 'Phát bài viết ngay' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Dịch vụ chưa sẵn sàng.')
    expect(screen.getByRole('dialog', { name: 'Tùy chỉnh giọng đọc' })).toBeInTheDocument()
  })
})
