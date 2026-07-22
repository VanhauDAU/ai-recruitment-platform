import dayjs from 'dayjs'

const hasText = (value) => String(value || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0

export function capitalizeTitleWords(value) {
  if (typeof value !== 'string') return value
  return value.replace(/(^|[\s/(-])(\p{L})/gu, (_, separator, letter) => (
    `${separator}${letter.toLocaleUpperCase('vi-VN')}`
  ))
}

function salaryIsComplete(values) {
  if (values.salary_type === 'negotiable') return true
  if (values.salary_type === 'range') return values.salary_min != null || values.salary_max != null
  if (values.salary_type === 'up_to') return values.salary_max != null
  return values.salary_min != null
}

export function createJobFormValues(initialValues = {}) {
  const assignments = initialValues.category_assignments || []
  const primary = assignments.find((item) => item.role === 'primary_specialization')
  const domains = assignments.filter((item) => item.role === 'domain_knowledge')
  const contact = initialValues.application_contact || {}
  const skills = initialValues.job_skills || []
  const groupedAreas = new Map()
  ;(initialValues.job_locations || []).forEach((item) => {
    const area = groupedAreas.get(item.province_id) || {
      province_id: item.province_id,
      workplaces: [],
    }
    area.workplaces.push({ location: item.location, address_detail: item.address_detail })
    groupedAreas.set(item.province_id, area)
  })
  return {
    currency: 'VND',
    number_of_vacancies: 1,
    ...initialValues,
    work_types: initialValues.work_types?.length
      ? initialValues.work_types
      : initialValues.work_type ? [initialValues.work_type] : [],
    salary_type: initialValues.salary_type || 'range',
    income_display_type: initialValues.income_display_type || 'income',
    deadline: initialValues.deadline ? dayjs(initialValues.deadline) : null,
    category_assignments: [primary || { role: 'primary_specialization', sort_order: 0 }],
    domain_category_ids: domains.map((item) => item.category),
    work_areas: groupedAreas.size ? [...groupedAreas.values()] : [{ workplaces: [{}] }],
    work_schedules: initialValues.work_schedules?.length
      ? initialValues.work_schedules.map((item) => ({
          ...item,
          start_time: item.start_time ? dayjs(`2000-01-01T${item.start_time}`) : null,
          end_time: item.end_time ? dayjs(`2000-01-01T${item.end_time}`) : null,
        }))
      : [{ weekday_from: 1, weekday_to: 5, sort_order: 0 }],
    required_skill_ids: skills.filter((item) => item.importance === 'required').map((item) => item.skill),
    preferred_skill_ids: skills.filter((item) => item.importance === 'preferred').map((item) => item.skill),
    benefit_ids: (initialValues.job_benefits || []).map((item) => item.benefit),
    language_requirements: initialValues.language_requirements?.length
      ? initialValues.language_requirements.map((item) => ({
          id: item.id,
          language: item.language,
          proficiency_level: item.proficiency_level || '',
        }))
      : [],
    application_contact: {
      recipient_name: contact.recipient_name || '',
      phone: contact.phone || '',
      emails: (contact.emails || []).map((item) => item.email),
    },
  }
}

export function buildJobPayload(values) {
  const salaryType = values.salary_type || 'range'
  const contact = values.application_contact || {}
  const emails = (contact.emails || []).map((email, index) => ({
    email: email.trim().toLowerCase(),
    sort_order: index,
  }))
  const hasContact = contact.recipient_name?.trim() || contact.phone?.trim() || emails.length
  const requiredSkillIds = values.required_skill_ids || []
  const preferredSkillIds = (values.preferred_skill_ids || []).filter((id) => !requiredSkillIds.includes(id))
  const persistedValues = { ...values }
  delete persistedValues.required_skill_ids
  delete persistedValues.preferred_skill_ids
  delete persistedValues.benefit_ids
  delete persistedValues.domain_category_ids
  delete persistedValues.work_areas

  return {
    ...persistedValues,
    work_type: values.work_types?.[0] || values.work_type || '',
    deadline: values.deadline?.format('YYYY-MM-DD') || null,
    salary_min: ['range', 'fixed', 'from'].includes(salaryType) ? values.salary_min ?? null : null,
    salary_max: ['range', 'up_to'].includes(salaryType) ? values.salary_max ?? null : null,
    age_min: values.age_min ?? null,
    age_max: values.age_max ?? null,
    category_assignments: [
      ...(values.category_assignments?.[0]?.category
        ? [{ category: values.category_assignments[0].category, role: 'primary_specialization', sort_order: 0 }]
        : []),
      ...(values.domain_category_ids || []).map((category, index) => ({
        category,
        role: 'domain_knowledge',
        sort_order: index + 1,
      })),
    ],
    job_locations: (values.work_areas || []).flatMap((area) => (
      (area.workplaces || [])
        .filter((item) => item.location)
        .map((item) => ({ location: item.location, address_detail: item.address_detail?.trim() || '' }))
    )).map((item, index) => ({ ...item, sort_order: index })),
    work_schedules: (values.work_schedules || [])
      .filter((item) => item.weekday_from && item.weekday_to && item.start_time)
      .map((item, index) => ({
        ...item,
        start_time: item.start_time.format('HH:mm:ss'),
        end_time: item.end_time?.format('HH:mm:ss') || null,
        note: item.note?.trim() || '',
        sort_order: index,
      })),
    job_skills: [
      ...requiredSkillIds.map((skill) => ({ skill, importance: 'required', weight: 1 })),
      ...preferredSkillIds.map((skill) => ({ skill, importance: 'preferred', weight: 1 })),
    ],
    job_benefits: (values.benefit_ids || []).map((benefit, index) => ({ benefit, sort_order: index })),
    language_requirements: (values.language_requirements || [])
      .filter((item) => item.language)
      .map((item, index) => ({
        ...(item.id ? { id: item.id } : {}),
        language: item.language,
        proficiency_level: item.proficiency_level || '',
        certificate: '',
        note: '',
        is_required: true,
        sort_order: index,
      })),
    application_contact: hasContact
      ? {
          recipient_name: contact.recipient_name?.trim() || '',
          phone: contact.phone?.trim() || '',
          emails,
        }
      : null,
  }
}

export function getJobFormProgress(values = {}) {
  const primaryCategory = values.category_assignments?.[0]?.category
  const workplaces = (values.work_areas || []).flatMap((area) => area.workplaces || [])
  const groups = [
    {
      key: 'general',
      label: 'Thông tin chung',
      items: [
        { label: 'Tiêu đề tin', done: hasText(values.title), errorFields: ['title'] },
        { label: 'Vị trí chuyên môn', done: Boolean(primaryCategory), errorFields: ['category_assignments'] },
        { label: 'Cấp bậc', done: Boolean(values.position_level), errorFields: ['position_level'] },
        { label: 'Loại công việc', done: Boolean(values.employment_type), errorFields: ['employment_type'] },
        { label: 'Hình thức làm việc', done: Boolean(values.work_types?.length), errorFields: ['work_types'] },
        { label: 'Mức lương', done: salaryIsComplete(values), errorFields: ['salary_type', 'salary_min', 'salary_max'] },
      ],
    },
    {
      key: 'description',
      label: 'Mô tả công việc',
      items: [
        { label: 'Mô tả công việc', done: hasText(values.description), errorFields: ['description'] },
        { label: 'Yêu cầu ứng viên', done: hasText(values.requirements), errorFields: ['requirements'] },
        { label: 'Quyền lợi ứng viên', done: hasText(values.benefits), errorFields: ['benefits'] },
        { label: 'Địa điểm làm việc', done: workplaces.some((item) => Boolean(item.location)), errorFields: ['work_areas'] },
      ],
    },
    {
      key: 'expectations',
      label: 'Kỳ vọng về ứng viên',
      items: [
        { label: 'Học vấn', done: Boolean(values.education_level), errorFields: ['education_level'] },
        { label: 'Kinh nghiệm', done: Boolean(values.experience_years), errorFields: ['experience_years'] },
        { label: 'Độ tuổi', done: values.age_min != null && values.age_max != null, errorFields: ['age_min', 'age_max'] },
        { label: 'Ngoại ngữ', done: Boolean(values.language_requirements?.some((item) => item.language)), errorFields: ['language_requirements'] },
      ],
    },
    {
      key: 'application',
      label: 'Thông tin nhận hồ sơ',
      items: [
        { label: 'Hạn nhận hồ sơ', done: Boolean(values.deadline), errorFields: ['deadline'] },
        { label: 'Số lượng tuyển', done: Number(values.number_of_vacancies) > 0, errorFields: ['number_of_vacancies'] },
        { label: 'Người nhận hồ sơ', done: hasText(values.application_contact?.recipient_name), errorFields: ['application_contact.recipient_name'] },
        { label: 'Số điện thoại', done: hasText(values.application_contact?.phone), errorFields: ['application_contact.phone'] },
        { label: 'Email nhận hồ sơ', done: Boolean(values.application_contact?.emails?.length), errorFields: ['application_contact.emails'] },
      ],
    },
    { key: 'services', label: 'Dịch vụ và gia tăng hiệu quả', items: [] },
  ]

  return groups.map((group) => ({
    ...group,
    completed: group.items.filter((item) => item.done).length,
    total: group.items.length,
  }))
}
