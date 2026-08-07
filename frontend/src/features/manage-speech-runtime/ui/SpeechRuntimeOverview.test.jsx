import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSpeechAdminOverview } from '@/entities/speech'
import SpeechRuntimeOverview from './SpeechRuntimeOverview'

vi.mock('@/entities/speech', () => ({ getSpeechAdminOverview: vi.fn() }))

describe('SpeechRuntimeOverview', () => {
  beforeEach(() => {
    getSpeechAdminOverview.mockResolvedValue({
      artifacts: { size_bytes: 2048, total: 2 },
      policy: {
        speech_blog_enabled: true,
        speech_chatbot_enabled: false,
        speech_onboarding_enabled: false,
      },
      runtime: {
        status: 'unavailable',
      },
      usage: { days_7: { generation_count: 3, rejected_count: 1 } },
    })
  })

  it('keeps policy and usage visible when the runtime is unavailable', async () => {
    render(<SpeechRuntimeOverview />)

    expect(await screen.findByText('Vận hành giọng đọc')).toBeInTheDocument()
    expect(screen.getByText('TTS chưa nhận synthesis mới; các nội dung văn bản vẫn hoạt động bình thường.')).toBeInTheDocument()
    await waitFor(() => expect(getSpeechAdminOverview).toHaveBeenCalledOnce())
    expect(screen.getByText('Blog')).toBeInTheDocument()
  })
})
