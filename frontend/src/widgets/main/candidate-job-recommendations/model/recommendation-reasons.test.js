import { describe, expect, it } from 'vitest'
import { groupRecommendationJobs, recommendationReasons } from './recommendation-reasons'

describe('candidate recommendation presentation', () => {
  it('describes only strong search and skill signals', () => {
    expect(recommendationReasons({
      match_details: [
        { code: 'position' },
        { code: 'skills' },
        { code: 'location' },
      ],
    })).toEqual([
      'Phù hợp với tìm kiếm của bạn',
      'Phù hợp với kỹ năng của bạn',
    ])
    expect(recommendationReasons({
      match_details: [{ code: 'location' }, { code: 'salary' }, { code: 'experience' }],
    })).toEqual([])
  })

  it('keeps at most two pages of four jobs', () => {
    const jobs = Array.from({ length: 10 }, (_, index) => ({ public_id: `job_${index}` }))
    expect(groupRecommendationJobs(jobs)).toHaveLength(2)
    expect(groupRecommendationJobs(jobs).map((group) => group.length)).toEqual([4, 4])
  })
})
