import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { campaignGoalPayload, campaignGoalValues } from './campaign-goal'

describe('campaign goal values', () => {
  it('maps API dates to pickers and back, dropping the end date when continuous', () => {
    const values = campaignGoalValues({
      name: 'Tuyển Backend',
      start_date: '2026-12-01',
      target_date: '2026-12-31',
      headcount_target: 3,
    })

    expect(values.start_date.format('YYYY-MM-DD')).toBe('2026-12-01')
    expect(values.budget_source).toBe('company')
    expect(campaignGoalPayload({ ...values, name: '  Tuyển Backend ' })).toMatchObject({
      name: 'Tuyển Backend',
      start_date: '2026-12-01',
      target_date: '2026-12-31',
    })
    expect(campaignGoalPayload({
      ...values,
      is_continuous: true,
      target_date: dayjs('2026-12-31'),
    }).target_date).toBeNull()
  })
})
