import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelJobAiGeneration,
  createJobAiGeneration,
  getJobAiGeneration,
  sendJobAiGenerationFeedback,
} from './job-ai-generation.api'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/shared/api/client', () => ({ default: mocks }))

describe('job AI generation API', () => {
  beforeEach(() => {
    mocks.get.mockReset()
    mocks.post.mockReset()
  })

  it('creates a generation with the backend DTO unchanged', async () => {
    const payload = {
      mode: 'ai_brief',
      idempotency_key: 'job-ai-123',
      locale: 'vi-VN',
      brief: { position: 'Kỹ sư Backend' },
    }
    const response = { public_id: 'generation_1', status: 'queued', phase: 'queued' }
    mocks.post.mockResolvedValue({ data: response })

    await expect(createJobAiGeneration(payload)).resolves.toEqual(response)
    expect(mocks.post).toHaveBeenCalledWith('/jobs/mine/ai-generations/', payload)
  })

  it('reads, cancels and sends feedback for an owned generation', async () => {
    mocks.get.mockResolvedValue({ data: { public_id: 'generation_1' } })
    mocks.post
      .mockResolvedValueOnce({ data: { status: 'cancelled' } })
      .mockResolvedValueOnce({ data: { value: 'helpful', reason: null } })

    await getJobAiGeneration('generation_1')
    await cancelJobAiGeneration('generation_1')
    await sendJobAiGenerationFeedback('generation_1', { value: 'helpful' })

    expect(mocks.get).toHaveBeenCalledWith('/jobs/mine/ai-generations/generation_1/')
    expect(mocks.post).toHaveBeenNthCalledWith(1, '/jobs/mine/ai-generations/generation_1/cancel/')
    expect(mocks.post).toHaveBeenNthCalledWith(2, '/jobs/mine/ai-generations/generation_1/feedback/', { value: 'helpful' })
  })
})
