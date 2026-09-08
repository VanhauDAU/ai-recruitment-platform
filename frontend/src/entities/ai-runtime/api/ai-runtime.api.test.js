import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/shared/api/client'
import { getAiRuntimeOverview } from './ai-runtime.api'

vi.mock('@/shared/api/client', () => ({ default: { get: vi.fn() } }))

describe('AI runtime API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the protected 30-day admin overview', async () => {
    const response = { runtime: { status: 'ready' } }
    api.get.mockResolvedValue({ data: response })

    await expect(getAiRuntimeOverview()).resolves.toEqual(response)

    expect(api.get).toHaveBeenCalledWith('/ai/admin/overview/?days=30', {
      signal: undefined,
    })
  })

  it('forwards the abort signal', async () => {
    const controller = new AbortController()
    api.get.mockResolvedValue({ data: {} })

    await getAiRuntimeOverview({ signal: controller.signal })

    expect(api.get).toHaveBeenCalledWith('/ai/admin/overview/?days=30', {
      signal: controller.signal,
    })
  })
})
