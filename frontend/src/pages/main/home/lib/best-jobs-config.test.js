import { describe, expect, it } from 'vitest'
import {
  BEST_JOBS_PAGE_SIZE,
  buildBestJobsChips,
  buildBestJobsParams,
} from './best-jobs-config'

describe('homepage Best Jobs configuration', () => {
  it('uses a dedicated rotation seed and preview endpoint contract', () => {
    const params = buildBestJobsParams({
      location: '79',
      salary: null,
      experience: null,
      category: null,
    }, 2, 'home-load-two')

    expect(params.get('page')).toBe('2')
    expect(params.get('page_size')).toBe(String(BEST_JOBS_PAGE_SIZE))
    expect(params.get('rotation_seed')).toBe('home-load-two')
    expect(params.get('location')).toBe('79')
    expect(params.has('ranking_seed')).toBe(false)
    expect(params.has('ordering')).toBe(false)
  })

  it('names the unfiltered location option Ngẫu nhiên', () => {
    const chips = buildBestJobsChips('location', {
      featuredWards: [],
      parents: [],
      provinces: [],
    })

    expect(chips[0]).toEqual({ value: null, label: 'Ngẫu nhiên' })
  })
})
