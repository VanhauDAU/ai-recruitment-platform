import { describe, expect, it } from 'vitest'
import {
  COMPARISON_GROUPS,
  comparisonRowIsDifferent,
  MISSING_VALUE,
} from './comparison-presentation'

function row(key) {
  return COMPARISON_GROUPS.flatMap((group) => group.rows).find((item) => item.key === key)
}

describe('job comparison presentation', () => {
  it('uses the agreed missing and unlimited vacancy labels', () => {
    expect(row('company-size').value({}).display).toBe(MISSING_VALUE)
    expect(row('vacancies').value({ number_of_vacancies: null }).display).toBe('Không giới hạn')
  })

  it('falls back from multiple work types to the legacy single value', () => {
    expect(row('work-types').value({ work_type: 'remote' }).display).toMatch(/Từ xa/i)
    expect(row('work-types').value({ work_type: 'remote', work_types: ['onsite', 'hybrid'] }).items)
      .toHaveLength(2)
  })

  it('marks neutral differences without ranking values', () => {
    const salary = row('salary')
    const jobs = [
      { salary_type: 'negotiable' },
      { salary_type: 'range', salary_min: 20, salary_max: 30, currency: 'VND' },
    ]

    expect(comparisonRowIsDifferent(salary, jobs)).toBe(true)
    expect(comparisonRowIsDifferent(salary, [jobs[0], jobs[0]])).toBe(false)
  })
})
