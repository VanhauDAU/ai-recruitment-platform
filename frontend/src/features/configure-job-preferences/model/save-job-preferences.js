import { updateCandidateJobPreferences } from '@/entities/candidate-preferences'
import { FIELD_LABELS, PREFERENCE_FIELD_NAMES } from './job-preferences-fields'
import { normalizeDesiredPositionOthers } from './specialization-limit'

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key)
}

function currentSkillIds(preference) {
  if (Array.isArray(preference?.preferred_skills)) {
    return preference.preferred_skills.map((skill) => skill?.id).filter((id) => id != null)
  }
  return preference?.preferred_skill_ids || []
}

/**
 * Lưu nhu cầu công việc. Endpoint là full replace nên hai consent phải luôn có
 * giá trị: form không render checkbox nào (variant `default`) thì giữ lại lựa
 * chọn cũ thay vì vô tình hạ về false.
 */
export function saveJobPreferences(values, preference) {
  const rawCustomPositions = hasOwn(values, 'desired_position_others')
    ? values.desired_position_others
    : (hasOwn(values, 'desired_position_other')
      ? values.desired_position_other
      : (preference?.desired_position_others ?? preference?.desired_position_other))
  const desiredPositionOthers = normalizeDesiredPositionOthers(rawCustomPositions)
  const preferredSkillIds = hasOwn(values, 'preferred_skill_ids')
    ? values.preferred_skill_ids
    : currentSkillIds(preference)

  return updateCandidateJobPreferences({
    ...values,
    desired_position_others: desiredPositionOthers,
    // Dual-write while older consumers still read the scalar field.
    desired_position_other: desiredPositionOthers[0] || '',
    desired_salary_vnd: values.desired_salary_vnd ?? null,
    ai_recommendation_consent: values.ai_recommendation_consent ?? Boolean(preference?.ai_recommendation_consent),
    recruiter_visibility_consent: values.recruiter_visibility_consent ?? Boolean(preference?.recruiter_visibility_consent),
    preferred_skill_ids: [...new Set((preferredSkillIds || []).filter((id) => id != null))],
  })
}

/**
 * Tách lỗi theo trường khỏi response DRF. Trả mảng rỗng khi là lỗi chung
 * (throttle, 5xx, mất mạng) để bề mặt gọi rơi về thông báo tổng.
 */
export function jobPreferenceFieldErrors(error) {
  const data = error?.response?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  return Object.entries(data)
    .filter(([name]) => PREFERENCE_FIELD_NAMES.includes(name))
    .map(([name, errors]) => ({
      errors: [].concat(errors),
      label: FIELD_LABELS[name] || name,
      name,
    }))
}
