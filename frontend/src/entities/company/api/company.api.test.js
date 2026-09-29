import { beforeEach, describe, expect, it, vi } from 'vitest'
import client from '@/shared/api/client'
import { getPublicCompanies } from './company.api'

vi.mock('@/shared/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}))

describe('public company api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the finite featured envelope without a search mode parameter', async () => {
    const signal = new AbortController().signal
    client.get.mockResolvedValue({ data: { next: null, previous: null, results: [] } })

    await getPublicCompanies({}, { signal })

    expect(client.get).toHaveBeenCalledWith('/companies/', {
      params: {},
      signal,
    })
  })

  it('requests a cursor page and forwards the abort signal', async () => {
    const signal = new AbortController().signal
    client.get.mockResolvedValue({ data: { count: 42, next: null, results: [] } })

    const response = await getPublicCompanies({ q: 'FPT', cursor: 'next-page' }, { signal })

    expect(client.get).toHaveBeenCalledWith('/companies/', {
      params: { q: 'FPT', cursor: 'next-page' },
      signal,
    })
    expect(response.count).toBe(42)
  })
})
