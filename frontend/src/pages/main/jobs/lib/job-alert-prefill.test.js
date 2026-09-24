import { describe, expect, it } from 'vitest'
import { buildJobAlertPrefill } from './job-alert-prefill'

describe('buildJobAlertPrefill', () => {
  it('prefills exact single-valued filters and resolves a ward parent', () => {
    const values = buildJobAlertPrefill({
      provinces: [{ id: 1, name: 'Hà Nội' }],
      selectedLocationGroups: [{
        province: { id: 1, name: 'Hà Nội' },
        wards: [{ id: 10, name: 'Cầu Giấy' }],
      }],
      searchParams: new URLSearchParams('search=Frontend&cat=3&locations=10&exp=2&salary=15-20&wt=hybrid&et=full_time'),
    })
    expect(values).toEqual({
      keyword: 'Frontend',
      keyword_scope: 'title',
      frequency: 'daily',
      category_ids: [3],
      experience_years: '2',
      salary_bucket: '15-20',
      work_type: 'hybrid',
      employment_type: 'full_time',
      province_id: 1,
      ward_id: 10,
    })
  })

  it('preserves every category while dropping other unsupported multi-select filters', () => {
    const values = buildJobAlertPrefill({
      searchParams: new URLSearchParams('cat=1,2&locations=1,2&exp=1,2&salary=10-&search_by=both'),
    })

    expect(values).toEqual({
      keyword_scope: 'both',
      frequency: 'daily',
      category_ids: [1, 2],
      prefillNotice: 'Các bộ lọc chọn nhiều giá trị (Kinh nghiệm, Địa điểm) chưa được điền sẵn. Mỗi thông báo chỉ hỗ trợ một giá trị cho các trường này; vui lòng chọn lại trong biểu mẫu.',
    })
  })

  it.each([
    ['-10', 'u10'],
    ['50-', 'o50'],
  ])('maps the exact edge salary range %s to bucket %s', (salary, salaryBucket) => {
    expect(buildJobAlertPrefill({
      searchParams: new URLSearchParams({ salary }),
    }).salary_bucket).toBe(salaryBucket)
  })
})
