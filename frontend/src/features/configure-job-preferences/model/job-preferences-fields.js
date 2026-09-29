import { normalizeDesiredPositionOthers } from './specialization-limit'

export const EXPERIENCE_OPTIONS = [
  ['no_experience', 'Chưa có kinh nghiệm'],
  ['under_1', 'Dưới 1 năm'],
  ['1', '1 năm'],
  ['2', '2 năm'],
  ['3', '3 năm'],
  ['4', '4 năm'],
  ['5', '5 năm'],
  ['over_5', 'Trên 5 năm'],
].map(([value, label]) => ({ value, label }))

export const FIELD_LABELS = {
  desired_specialization_ids: 'Vị trí chuyên môn',
  desired_position_others: 'Vị trí chuyên môn khác',
  desired_position_other: 'Vị trí chuyên môn khác',
  desired_salary_vnd: 'Mức lương',
  experience_level: 'Kinh nghiệm',
  preferred_province_ids: 'Địa điểm làm việc',
  willing_to_relocate: 'Khả năng thay đổi địa điểm làm việc',
  ai_recommendation_consent: 'Đồng ý nhận gợi ý việc làm',
  recruiter_visibility_consent: 'Cho phép nhà tuyển dụng tìm thấy và xem hồ sơ',
  preferred_skill_ids: 'Kỹ năng',
}

/** Đúng bộ trường mà `PUT /api/candidate/job-preferences/` nhận và trả lỗi. */
export const PREFERENCE_FIELD_NAMES = Object.keys(FIELD_LABELS)

export function toFormValues(preference) {
  const customPositions = Array.isArray(preference?.desired_position_others)
    ? preference.desired_position_others
    : preference?.desired_position_other
  const preferredSkills = Array.isArray(preference?.preferred_skills)
    ? preference.preferred_skills.map((item) => item?.id)
    : preference?.preferred_skill_ids

  return {
    desired_specialization_ids: preference?.desired_specializations?.map((item) => item.id) || [],
    desired_position_others: normalizeDesiredPositionOthers(customPositions),
    desired_salary_vnd: preference?.desired_salary_vnd ?? null,
    experience_level: preference?.experience_level || undefined,
    preferred_province_ids: preference?.preferred_provinces?.map((item) => item.id) || [],
    willing_to_relocate: preference?.willing_to_relocate ?? false,
    ai_recommendation_consent: Boolean(preference?.ai_recommendation_consent),
    recruiter_visibility_consent: Boolean(preference?.recruiter_visibility_consent),
    preferred_skill_ids: [...new Set((preferredSkills || []).filter((id) => id != null))],
  }
}
