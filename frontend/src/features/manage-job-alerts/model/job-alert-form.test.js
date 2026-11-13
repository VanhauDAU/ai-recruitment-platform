import { describe, expect, it } from 'vitest'
import {
  formatJobAlertDelivery,
  jobAlertFormValues,
  jobAlertPayload,
  jobAlertPrefillFromSearchParams,
  jobAlertResultsPath,
} from './job-alert-form'

describe('job alert form contract', () => {
  it('formats delivery time explicitly in the Vietnam timezone', () => {
    expect(formatJobAlertDelivery('2026-08-17T01:00:00Z')).toBe('17/08/2026 lúc 08:00')
    expect(formatJobAlertDelivery('not-a-date')).toBe('')
  })

  it('writes only the locked alert fields and trims the keyword', () => {
    expect(jobAlertPayload({
      keyword: '  Frontend Developer  ',
      keyword_scope: 'both',
      category_ids: ['12', 15, 12],
      province_id: 1,
      ward_id: '',
      salary_bucket: '15-20',
      experience_years: '2',
      work_type: 'hybrid',
      employment_type: 'full_time',
      frequency: 'weekly',
      email: 'ignored@example.com',
      public_id: 'ignored',
    })).toEqual({
      keyword: 'Frontend Developer',
      keyword_scope: 'both',
      category_ids: [12, 15],
      province_id: 1,
      ward_id: null,
      salary_bucket: '15-20',
      experience_years: '2',
      work_type: 'hybrid',
      employment_type: 'full_time',
      frequency: 'weekly',
    })
  })

  it('reads IDs from both flat and resolved response fields', () => {
    expect(jobAlertFormValues({
      keyword: 'Data Engineer',
      categories: [{ id: 9, name: 'Dữ liệu' }, { id: 10, name: 'Data Engineer' }],
      province: { id: 1, name: 'Hà Nội' },
      ward_id: 10,
    })).toMatchObject({ category_ids: [9, 10], province_id: 1, ward_id: 10 })
  })

  it('drops invalid prefill values instead of forwarding them to the API', () => {
    const params = new URLSearchParams('keyword=QA&keyword_scope=invalid&category_ids=x,-1&salary_bucket=nego&frequency=weekly')

    expect(jobAlertPrefillFromSearchParams(params)).toMatchObject({
      keyword: 'QA',
      keyword_scope: 'title',
      category_ids: [],
      salary_bucket: null,
      frequency: 'weekly',
    })
  })

  it('maps a saved alert back to the public job-list URL', () => {
    const path = jobAlertResultsPath({
      keyword: 'Backend Developer',
      keyword_scope: 'both',
      category_ids: [12, 13],
      province_id: 1,
      salary_bucket: '20-25',
      experience_years: '3',
      work_type: 'remote',
      employment_type: 'full_time',
    })
    const url = new URL(path, 'https://example.test')

    expect(Object.fromEntries(url.searchParams)).toEqual({
      search: 'Backend Developer',
      search_by: 'both',
      cat: '12,13',
      locations: '1',
      salary: '20-25',
      exp: '3',
      wt: 'remote',
      et: 'full_time',
    })
  })

  it.each([
    ['u10', '-10'],
    ['o50', '50-'],
  ])('maps salary bucket %s back to job-list range %s', (salaryBucket, salaryParam) => {
    const url = new URL(jobAlertResultsPath({ salary_bucket: salaryBucket }), 'https://example.test')
    expect(url.searchParams.get('salary')).toBe(salaryParam)
  })
})
