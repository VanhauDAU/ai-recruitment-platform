import { beforeEach, describe, expect, it, vi } from 'vitest'
import client from '@/shared/api/client'
import {
  getCompanyJobFacets,
  getPublicCompanies,
  getPublicCompany,
  getSimilarCompanies,
} from './company.api'

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

  it('requests the company page read model by slug', async () => {
    const signal = new AbortController().signal
    client.get.mockResolvedValue({ data: { public_id: 'co_ab12', slug: 'fpt-software' } })

    const profile = await getPublicCompany('fpt-software', { signal })

    expect(client.get).toHaveBeenCalledWith('/companies/fpt-software/', { signal })
    expect(profile.public_id).toBe('co_ab12')
  })

  it('escapes a slug taken from the URL before using it as a path segment', async () => {
    client.get.mockResolvedValue({ data: {} })

    await getPublicCompany('a/b?c')

    expect(client.get).toHaveBeenCalledWith('/companies/a%2Fb%3Fc/', { signal: undefined })
  })

  it('requests similar companies and job facets by public id', async () => {
    const signal = new AbortController().signal
    client.get.mockResolvedValueOnce({ data: { results: [{ public_id: 'co_other' }] } })
    client.get.mockResolvedValueOnce({ data: { locations: [{ id: 1, name: 'Hà Nội', count: 7 }] } })

    const similar = await getSimilarCompanies('co_ab12', { signal })
    const facets = await getCompanyJobFacets('co_ab12', { signal })

    expect(client.get).toHaveBeenNthCalledWith(1, '/companies/co_ab12/similar/', { signal })
    expect(client.get).toHaveBeenNthCalledWith(2, '/companies/co_ab12/job-facets/', { signal })
    expect(similar.results).toHaveLength(1)
    expect(facets.locations[0].count).toBe(7)
  })
})
