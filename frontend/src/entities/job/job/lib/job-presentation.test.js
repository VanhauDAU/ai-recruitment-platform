// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { jobLabels } from './job-presentation'

describe('jobLabels', () => {
  it('reads only the system labels the backend computed', () => {
    const labels = [{ code: 'closing_soon', text: 'Sắp hết hạn', tone: 'warning' }]

    expect(jobLabels({ presentation: { labels } })).toBe(labels)
  })

  it('has no fallback that rebuilds labels from retired fields', () => {
    expect(jobLabels({ tier: 'top', is_hot: true, is_urgent: true })).toEqual([])
    expect(jobLabels(undefined)).toEqual([])
  })
})
