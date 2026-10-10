import { describe, expect, it } from 'vitest'
import { bestJobCardClass, isTopEmployerJob } from './best-job-card-presentation'

describe('best job card presentation', () => {
  it('keeps a paid eligible job white when its company is not a top employer', () => {
    const job = {
      brand_slug: null,
      presentation: { placement: 'best_jobs_eligible', card_tone: 'green_strong' },
    }

    expect(isTopEmployerJob(job)).toBe(false)
    expect(bestJobCardClass(job)).toContain('bg-white')
    expect(bestJobCardClass(job)).not.toContain('border-l-4')
  })

  it('uses the pale-green card and dark-green accent for a top employer', () => {
    const job = { brand_slug: 'cong-ty-kim-cuong' }

    expect(isTopEmployerJob(job)).toBe(true)
    expect(bestJobCardClass(job)).toContain('bg-[#f2fbf6]')
    expect(bestJobCardClass(job)).toContain('border-l-[#00b14f]')
  })
})
