import { describe, expect, it } from 'vitest'
import { buildJobDetailAlertPrefill } from './job-detail-alert-prefill'

const JOB = {
  title: 'Nhân viên kinh doanh tại Hà Nội - Thu nhập hấp dẫn',
  category: 6,
  category_name: 'Kinh doanh/Bán hàng',
  primary_specialization: { id: 8, name: 'Nhân viên kinh doanh' },
  locations_detail: [{ id: 1, name: 'Hà Nội' }],
  workplace_groups: [{
    province_id: 1,
    province_name: 'Hà Nội',
    addresses: [{ ward_id: 11, ward_name: 'Phường Hoàn Kiếm' }],
  }],
  salary_type: 'range',
  salary_min: 30_000_000,
  salary_max: 50_000_000,
  currency: 'VND',
  experience_years: 'none',
  work_type: 'onsite',
  employment_type: 'full_time',
}

describe('buildJobDetailAlertPrefill', () => {
  it('prefills one exact workplace and criteria from the primary specialization', () => {
    expect(buildJobDetailAlertPrefill(JOB)).toEqual({
      keyword: 'Nhân viên kinh doanh',
      keyword_scope: 'title',
      category_ids: [8],
      province_id: 1,
      ward_id: 11,
      salary_bucket: '30-50',
      experience_years: 'none',
      work_type: 'onsite',
      employment_type: 'full_time',
      frequency: 'daily',
    })
  })

  it('keeps a single province but does not choose between multiple wards', () => {
    const values = buildJobDetailAlertPrefill({
      ...JOB,
      workplace_groups: [{
        province_id: 1,
        addresses: [{ ward_id: 11 }, { ward_id: 12 }],
      }],
    })

    expect(values.province_id).toBe(1)
    expect(values).not.toHaveProperty('ward_id')
  })

  it('does not arbitrarily choose a province for a multi-province job', () => {
    const values = buildJobDetailAlertPrefill({
      ...JOB,
      locations_detail: [{ id: 1 }, { id: 2 }],
      workplace_groups: [
        { province_id: 1, addresses: [{ ward_id: 11 }] },
        { province_id: 2, addresses: [{ ward_id: 21 }] },
      ],
    })

    expect(values).not.toHaveProperty('province_id')
    expect(values).not.toHaveProperty('ward_id')
    expect(values.prefillNotice).toMatch(/nhiều tỉnh\/thành/i)
  })

  it.each([
    [{ salary_type: 'range', salary_min: 18_000_000, salary_max: 22_000_000, currency: 'VND' }, 'custom VND range'],
    [{ salary_type: 'negotiable', salary_min: null, salary_max: null, currency: 'VND' }, 'negotiable salary'],
    [{ salary_type: 'range', salary_min: 30, salary_max: 50, currency: 'USD' }, 'non-VND salary'],
  ])('does not force %s into a salary bucket', (salary) => {
    expect(buildJobDetailAlertPrefill({ ...JOB, ...salary })).not.toHaveProperty('salary_bucket')
  })

  it('falls back to the legacy category name and id when specialization is unavailable', () => {
    expect(buildJobDetailAlertPrefill({
      ...JOB,
      primary_specialization: null,
    })).toEqual(expect.objectContaining({
      keyword: 'Kinh doanh/Bán hàng',
      category_ids: [6],
    }))
  })
})

