// Từ vựng của mức phù hợp CV–tin, dùng chung cho ứng viên ("Xem độ phù hợp") và nhà
// tuyển dụng (xếp hạng hồ sơ). Khóa khớp `result_json` của backend
// (apps/matching/services/scoring): mọi con số lấy từ kết quả, ở đây chỉ có nhãn.
import { m } from '@/shared/config/i18n'

// Bốn mức theo điểm tổng; `from` là điểm thấp nhất của mức.
export const FIT_BANDS = [
  { key: 'low', from: 0, label: () => m.fit_level_low() },
  { key: 'medium', from: 50, label: () => m.fit_level_medium() },
  { key: 'high', from: 65, label: () => m.fit_level_high() },
  { key: 'very_high', from: 80, label: () => m.fit_level_very_high() },
]

export function bandOf(score) {
  return [...FIT_BANDS].reverse().find((band) => score >= band.from) || FIT_BANDS[0]
}

export function fitLevelLabel(level) {
  return (FIT_BANDS.find((band) => band.key === level) || FIT_BANDS[0]).label()
}

const CRITERIA = {
  skills: () => m.fit_criterion_skills(),
  experience: () => m.fit_criterion_experience(),
  education: () => m.fit_criterion_education(),
  position_level: () => m.fit_criterion_position_level(),
  languages: () => m.fit_criterion_languages(),
  // Chỉ còn trong kết quả cũ (`hybrid-v1`).
  location: () => m.fit_criterion_location(),
}

export function criterionLabel(key) {
  return CRITERIA[key]?.() || key
}

const CRITERION_STATUS = {
  insufficient_data: () => m.fit_status_insufficient_data(),
  not_required: () => m.fit_status_not_required(),
}

export function criterionStatusLabel(status) {
  return CRITERION_STATUS[status]?.() || ''
}

const CONFIDENCE = {
  high: () => m.fit_confidence_high(),
  medium: () => m.fit_confidence_medium(),
  low: () => m.fit_confidence_low(),
}

export function confidenceLabel(confidence) {
  return CONFIDENCE[confidence]?.() || ''
}

const LEVELS = {
  employee: () => m.job_level_employee(),
  team_lead: () => m.job_level_team_lead(),
  manager: () => m.job_level_manager(),
  supervisor: () => m.job_level_supervisor(),
  branch_manager: () => m.job_level_branch_manager(),
  vice_director: () => m.job_level_vice_director(),
  director: () => m.job_level_director(),
  intern: () => m.job_level_intern(),
}

const EDUCATION = {
  middle_school: () => m.job_education_middle_school(),
  high_school: () => m.job_education_high_school(),
  intermediate: () => m.job_education_intermediate(),
  college: () => m.job_education_college(),
  university: () => m.job_education_university(),
  postgraduate: () => m.job_education_postgraduate(),
}

const LANGUAGES = {
  en: () => m.fit_language_en(),
  ja: () => m.fit_language_ja(),
  ko: () => m.fit_language_ko(),
  zh: () => m.fit_language_zh(),
  fr: () => m.fit_language_fr(),
  vi: () => m.fit_language_vi(),
}

function durationText(months) {
  if (months < 12) return m.fit_duration_months({ count: months })
  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest ? m.fit_duration_years_months({ years, months: rest }) : m.fit_duration_years({ count: years })
}

function experienceBandText(band) {
  if (band === 'under_1') return m.job_experience_under_1()
  if (band === 'over_5') return m.job_experience_over_5()
  return m.job_experience_years({ count: band })
}

function experienceSummary(detail) {
  const parts = []
  if (detail.cv_months != null) {
    const cv = durationText(detail.cv_months)
    parts.push(
      detail.required_band && detail.required_band !== 'none'
        ? m.fit_summary_experience({ cv, required: experienceBandText(detail.required_band) })
        : m.fit_summary_experience_any({ cv }),
    )
  }
  if (detail.relevance_score != null) {
    parts.push(m.fit_summary_relevance({ score: Math.round(detail.relevance_score) }))
  }
  return parts.join(' ')
}

function languagesSummary(detail) {
  const missing = detail.missing_required || []
  if (!missing.length) return m.fit_summary_languages_ok()
  const names = missing.map((row) => LANGUAGES[row.code]?.() || row.code).join(', ')
  return m.fit_summary_languages_missing({ languages: names })
}

/**
 * Câu tóm tắt một tiêu chí, dựng từ `component.detail` để dịch được. Dành cho nhà
 * tuyển dụng; kết quả của ứng viên có sẵn `summary` do backend viết.
 */
export function criterionSummary(component) {
  const { key, status, detail = {} } = component
  if (status !== 'ok') return ''
  if (key === 'skills') {
    const matched = detail.matched?.length || 0
    return m.fit_summary_skills({ matched, total: matched + (detail.missing?.length || 0) })
  }
  if (key === 'experience') return experienceSummary(detail)
  if (key === 'education') {
    if (detail.required === 'none') return m.fit_summary_education_none()
    return m.fit_summary_education({
      required: EDUCATION[detail.required]?.() || detail.required,
      cv: EDUCATION[detail.cv]?.() || detail.cv,
    })
  }
  if (key === 'position_level') {
    return m.fit_summary_position_level({
      required: LEVELS[detail.required]?.() || detail.required,
      cv: LEVELS[detail.cv]?.() || detail.cv,
    })
  }
  if (key === 'languages') return languagesSummary(detail)
  return ''
}
