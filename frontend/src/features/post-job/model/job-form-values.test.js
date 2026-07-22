import { describe, expect, it } from 'vitest'
import { buildJobPayload, capitalizeTitleWords, createJobFormValues, getJobFormProgress } from './job-form-values'

describe('manual job form values', () => {
  it('capitalizes the first letter of each title word without lowercasing the remaining characters', () => {
    expect(capitalizeTitleWords('kỹ sư backend iOS - .NET developer')).toBe('Kỹ Sư Backend IOS - .NET Developer')
    expect(capitalizeTitleWords('trưởng/phó phòng (kinh doanh)')).toBe('Trưởng/Phó Phòng (Kinh Doanh)')
  })

  it('normalizes API detail data for the form without losing domain knowledge or contact emails', () => {
    const values = createJobFormValues({
      deadline: '2026-08-20',
      salary_type: 'fixed',
      salary_min: 15_000_000,
      work_type: 'onsite',
      income_display_type: 'income_at_kpi',
      category_assignments: [
        { category: 12, role: 'primary_specialization' },
        { category: 18, role: 'domain_knowledge' },
        { category: 19, role: 'domain_knowledge' },
      ],
      job_locations: [
        { province_id: 1, location: 2, address_detail: '12 Nguyễn Huệ' },
        { province_id: 1, location: 3, address_detail: '20 Lê Lợi' },
      ],
      job_skills: [
        { skill: 3, importance: 'required' },
        { skill: 4, importance: 'preferred' },
      ],
      job_benefits: [{ benefit: 8 }],
      language_requirements: [{
        id: 9,
        language: 2,
        proficiency_level: 'working',
        certificate: 'IELTS 6.5',
        note: 'Ưu tiên',
        is_required: false,
      }],
      work_schedules: [{ weekday_from: 1, weekday_to: 5, start_time: '08:00:00', end_time: '17:30:00' }],
      application_contact: { emails: [{ email: 'HR@Example.com' }] },
    })

    expect(values.deadline.format('YYYY-MM-DD')).toBe('2026-08-20')
    expect(values.category_assignments.map((item) => item.category)).toEqual([12])
    expect(values.domain_category_ids).toEqual([18, 19])
    expect(values.work_areas).toEqual([{
      province_id: 1,
      workplaces: [
        { location: 2, address_detail: '12 Nguyễn Huệ' },
        { location: 3, address_detail: '20 Lê Lợi' },
      ],
    }])
    expect(values.application_contact.emails).toEqual(['HR@Example.com'])
    expect(values.required_skill_ids).toEqual([3])
    expect(values.preferred_skill_ids).toEqual([4])
    expect(values.benefit_ids).toEqual([8])
    expect(values.work_schedules[0].start_time.format('HH:mm:ss')).toBe('08:00:00')
    expect(values.language_requirements).toEqual([{ id: 9, language: 2, proficiency_level: 'working' }])
    expect(values.salary_type).toBe('fixed')
    expect(values.salary_min).toBe(15_000_000)
    expect(values.income_display_type).toBe('income_at_kpi')
    expect(values.work_types).toEqual(['onsite'])
  })

  it('builds the nested write payload and clears salary fields that do not match the selected type', () => {
    const payload = buildJobPayload({
      title: 'Backend Engineer',
      work_types: ['onsite', 'hybrid'],
      salary_type: 'up_to',
      income_display_type: 'income_at_kpi',
      salary_min: 10_000_000,
      salary_max: 30_000_000,
      category_assignments: [
        { category: 12, role: 'primary_specialization' },
      ],
      domain_category_ids: [18, 19],
      work_areas: [{
        province_id: 1,
        workplaces: [
          { location: 2, address_detail: ' 12 Nguyễn Huệ ' },
          { location: 3, address_detail: ' 20 Lê Lợi ' },
          { location: 4, address_detail: '' },
        ],
      }],
      work_schedules: [{
        weekday_from: 1,
        weekday_to: 5,
        start_time: { format: () => '08:00:00' },
        end_time: { format: () => '17:00:00' },
      }, {
        weekday_from: 6,
        weekday_to: 6,
        start_time: { format: () => '09:00:00' },
        end_time: null,
      }],
      required_skill_ids: [3],
      preferred_skill_ids: [3, 4],
      benefit_ids: [8],
      language_requirements: [{ language: 2, proficiency_level: 'working', certificate: ' IELTS 6.5 ' }],
      application_contact: {
        recipient_name: ' Nguyễn An ',
        phone: ' 0912345678 ',
        emails: ['HR@Example.com'],
      },
    })

    expect(payload.salary_min).toBeNull()
    expect(payload.work_types).toEqual(['onsite', 'hybrid'])
    expect(payload.work_type).toBe('onsite')
    expect(payload.salary_max).toBe(30_000_000)
    expect(payload.income_display_type).toBe('income_at_kpi')
    expect(payload.category_assignments).toEqual([
      { category: 12, role: 'primary_specialization', sort_order: 0 },
      { category: 18, role: 'domain_knowledge', sort_order: 1 },
      { category: 19, role: 'domain_knowledge', sort_order: 2 },
    ])
    expect(payload.job_locations).toEqual([
      { location: 2, address_detail: '12 Nguyễn Huệ', sort_order: 0 },
      { location: 3, address_detail: '20 Lê Lợi', sort_order: 1 },
      { location: 4, address_detail: '', sort_order: 2 },
    ])
    expect(payload.application_contact).toEqual({
      recipient_name: 'Nguyễn An',
      phone: '0912345678',
      emails: [{ email: 'hr@example.com', sort_order: 0 }],
    })
    expect(payload.work_schedules[0]).toMatchObject({ start_time: '08:00:00', end_time: '17:00:00' })
    expect(payload.work_schedules[1]).toMatchObject({ start_time: '09:00:00', end_time: null })
    expect(payload.job_skills).toEqual([
      { skill: 3, importance: 'required', weight: 1 },
      { skill: 4, importance: 'preferred', weight: 1 },
    ])
    expect(payload.job_benefits).toEqual([{ benefit: 8, sort_order: 0 }])
    expect(payload.language_requirements[0]).toEqual({
      language: 2,
      proficiency_level: 'working',
      certificate: '',
      note: '',
      is_required: true,
      sort_order: 0,
    })
  })

  it('reports progress for all five manual-entry sections', () => {
    const progress = getJobFormProgress(createJobFormValues({ title: 'Backend Engineer' }))

    expect(progress.map(({ key, completed, total }) => ({ key, completed, total }))).toEqual([
      { key: 'general', completed: 1, total: 6 },
      { key: 'description', completed: 0, total: 4 },
      { key: 'expectations', completed: 0, total: 4 },
      { key: 'application', completed: 1, total: 5 },
      { key: 'services', completed: 0, total: 0 },
    ])
  })

  it('marks workplace progress complete when a ward is selected without address detail', () => {
    const progress = getJobFormProgress({
      work_areas: [{ workplaces: [{ location: 2, address_detail: '' }] }],
    })

    expect(progress[1].items.find((item) => item.label === 'Địa điểm làm việc').done).toBe(true)
  })
})
