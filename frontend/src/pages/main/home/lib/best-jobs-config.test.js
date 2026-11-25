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
    const chips = buildBestJobsChips('location', { locations: undefined })

    expect(chips).toEqual([{ value: null, label: 'Ngẫu nhiên' }])
  })

  it('builds location chips only from places that have jobs, provinces first', () => {
    const chips = buildBestJobsChips('location', {
      locations: {
        provinces: [
          { id: 1, name: 'Thành phố Hà Nội', job_count: 12 },
          { id: 2, name: 'Tỉnh Quảng Ninh', job_count: 3 },
        ],
        wards: [{ id: 10, name: 'Phường Ba Đình', parent_id: 1, parent_name: 'Thành phố Hà Nội', job_count: 5 }],
      },
    })

    expect(chips.slice(1)).toEqual([
      { value: 1, label: 'Hà Nội', count: 12 },
      { value: 2, label: 'Quảng Ninh', count: 3 },
      { value: 10, label: 'Ba Đình, Hà Nội', count: 5 },
    ])
  })

  it('caps the location chip strip', () => {
    const provinces = Array.from({ length: 40 }, (_, id) => ({ id, name: `Tỉnh ${id}`, job_count: 1 }))
    const chips = buildBestJobsChips('location', { locations: { provinces, wards: [] } })

    expect(chips).toHaveLength(21)
  })

  it('requests the configured number of best jobs per page', () => {
    const params = buildBestJobsParams({ location: null, salary: null, experience: null, category: null }, 1, 'seed', 18)

    expect(params.get('page_size')).toBe('18')
  })
})
