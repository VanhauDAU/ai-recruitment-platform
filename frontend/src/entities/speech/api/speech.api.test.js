import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/shared/api/client'
import { createBlogSpeechSession, getSpeechVoiceCatalog } from './speech.api'

vi.mock('@/shared/api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

describe('speech API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads capabilities only when requested', async () => {
    api.get.mockResolvedValue({ data: { voices: [] } })
    const controller = new AbortController()

    await getSpeechVoiceCatalog({ signal: controller.signal })

    expect(api.get).toHaveBeenCalledWith('/speech/voices/', { signal: controller.signal })
  })

  it('creates a source-scoped blog session without sending article text', async () => {
    api.post.mockResolvedValue({ data: { stream_url: '/tts/v1/streams/token' } })

    await createBlogSpeechSession({
      sourcePublicId: 'ps_public',
      voiceId: 'north-male-natural',
      style: 'tu_nhien',
    })

    expect(api.post).toHaveBeenCalledWith(
      '/speech/sessions/',
      {
        source_type: 'blog_post',
        source_public_id: 'ps_public',
        voice_id: 'north-male-natural',
        style: 'tu_nhien',
      },
      { signal: undefined },
    )
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('text')
  })

  it('omits preferences for one-click server defaults', async () => {
    api.post.mockResolvedValue({ data: { stream_url: '/tts/v1/streams/token' } })

    await createBlogSpeechSession({ sourcePublicId: 'ps_public' })

    expect(api.post).toHaveBeenCalledWith(
      '/speech/sessions/',
      { source_type: 'blog_post', source_public_id: 'ps_public' },
      { signal: undefined },
    )
  })
})
