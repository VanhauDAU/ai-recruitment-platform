import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get } }))

import {
  getCvCategories,
  getCvSampleContents,
  getCvTemplate,
  getCvTemplates,
  getRelatedCvTemplates,
} from './cv-template.api'

describe('CV template catalog API', () => {
  beforeEach(() => get.mockReset())

  it('uses only V2 endpoints and normalizes paginated card data', async () => {
    get
      .mockResolvedValueOnce({ data: { count: 1, results: [{ slug: 'modern' }] } })
      .mockResolvedValueOnce({ data: { slug: 'modern' } })
      .mockResolvedValueOnce({ data: { results: [{ slug: 'minimal' }] } })
      .mockResolvedValueOnce({ data: { results: [{ public_id: 'cat_design' }] } })
      .mockResolvedValueOnce({ data: { results: [{ public_id: 'sample_design' }] } })

    await expect(getCvTemplates({ locale: 'en-US', category: 'design' })).resolves.toEqual({ count: 1, results: [{ slug: 'modern' }] })
    await expect(getCvTemplate('modern', 'en-US')).resolves.toEqual({ slug: 'modern' })
    await expect(getRelatedCvTemplates('modern', 'en-US')).resolves.toEqual([{ slug: 'minimal' }])
    await expect(getCvCategories()).resolves.toEqual([{ public_id: 'cat_design' }])
    await expect(getCvSampleContents('en-US')).resolves.toEqual([{ public_id: 'sample_design' }])

    expect(get).toHaveBeenNthCalledWith(1, '/v2/cv-templates/', { params: { locale: 'en-US', category: 'design' } })
    expect(get).toHaveBeenNthCalledWith(2, '/v2/cv-templates/modern/', { params: { locale: 'en-US' } })
    expect(get).toHaveBeenNthCalledWith(3, '/v2/cv-templates/modern/related/', { params: { locale: 'en-US' } })
    expect(get).toHaveBeenNthCalledWith(4, '/v2/cv-categories/', { params: undefined })
    expect(get).toHaveBeenNthCalledWith(5, '/v2/cv-sample-contents/', { params: { locale: 'en-US' } })
  })
})
