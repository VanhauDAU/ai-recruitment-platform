import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/shared/api/client'
import {
  createBlogSpeechSession,
  createTextSpeechSession,
  getSpeechAdminOverview,
} from './speech.api'

vi.mock('@/shared/api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

describe('speech API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a fixed-policy blog session without article text or voice variants', async () => {
    api.post.mockResolvedValue({ data: { stream_url: '/tts/v1/streams/token' } })

    await createBlogSpeechSession({ sourcePublicId: 'ps_public' })

    expect(api.post).toHaveBeenCalledWith(
      '/speech/sessions/',
      { source_type: 'blog_post', source_public_id: 'ps_public' },
      { signal: undefined },
    )
  })

  it('requires the caller to identify a supported text surface', async () => {
    api.post.mockResolvedValue({ data: { stream_url: '/tts/v1/streams/token' } })

    await createTextSpeechSession({
      surface: 'chatbot',
      text: 'Xin chào, tôi là trợ lý ProCV.',
    })

    expect(api.post).toHaveBeenCalledWith(
      '/speech/sessions/',
      {
        source_type: 'text',
        surface: 'chatbot',
        text: 'Xin chào, tôi là trợ lý ProCV.',
      },
      { signal: undefined },
    )
  })

  it('loads the protected admin overview', async () => {
    api.get.mockResolvedValue({ data: { runtime: { status: 'ready' } } })

    await getSpeechAdminOverview()

    expect(api.get).toHaveBeenCalledWith('/speech/admin/overview/', { signal: undefined })
  })
})
