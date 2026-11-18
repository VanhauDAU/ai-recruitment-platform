import { describe, expect, it } from 'vitest'
import { formatSalary, getSalaryDisplayNote } from './job-options'

describe('formatSalary', () => {
  it('keeps KPI income as a secondary display note', () => {
    expect(formatSalary({
      income_display_type: 'income_at_kpi',
      salary_type: 'range',
      salary_min: 15_000_000,
      salary_max: 20_000_000,
    })).toBe('15 - 20 triệu')
    expect(getSalaryDisplayNote({ income_display_type: 'income_at_kpi' })).toBe('Khi đạt 100% KPI')
  })

  it('keeps standard salaries and negotiated income concise', () => {
    expect(formatSalary({ salary_type: 'fixed', salary_min: 12_000_000 })).toBe('12 triệu')
    expect(formatSalary({ income_display_type: 'income_at_kpi', salary_type: 'negotiable' }))
      .toBe('Thỏa thuận')
  })

  it('formats USD without applying the VND million conversion', () => {
    expect(formatSalary({
      currency: 'USD',
      salary_type: 'range',
      salary_min: 1_500,
      salary_max: 2_000,
    })).toBe('1,500 - 2,000 USD')
  })
})
