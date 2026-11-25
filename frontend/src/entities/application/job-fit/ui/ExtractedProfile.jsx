import { m } from '@/shared/config/i18n'
import {
  durationText,
  educationLevelLabel,
  languageLabel,
  languageLevelLabel,
  positionLevelLabel,
} from '../model/job-fit'
import './job-fit.css'

const SECTION_LABELS = {
  summary: () => m.fit_profile_section_summary(),
  experience: () => m.fit_profile_section_experience(),
  projects: () => m.fit_profile_section_projects(),
  education: () => m.fit_profile_section_education(),
  skills: () => m.fit_profile_section_skills(),
  certifications: () => m.fit_profile_section_certifications(),
  awards: () => m.fit_profile_section_awards(),
  activities: () => m.fit_profile_section_activities(),
  languages: () => m.fit_profile_section_languages(),
  interests: () => m.fit_profile_section_interests(),
  other: () => m.fit_profile_section_other(),
}

function Fact({ label, children }) {
  return (
    <div className="fit-fact">
      <dt>{label}</dt>
      <dd>{children || m.fit_profile_unknown()}</dd>
    </div>
  )
}

// 'YYYY-MM' → 'MM/YYYY'; giá trị khác giữ nguyên.
function month(value) {
  const [year, monthPart] = String(value).split('-')
  return monthPart ? `${monthPart}/${year}` : String(value)
}

function period(item) {
  if (!item.start && !item.end) return ''
  if (!item.start) return month(item.end)
  return `${month(item.start)} – ${item.end ? month(item.end) : m.fit_profile_present()}`
}

function SectionItem({ item }) {
  const heading = item.title || item.subtitle
  return (
    <li className="fit-entry">
      {heading && (
        <p className="fit-entry__head">
          <strong>{heading}</strong>
          {item.title && item.subtitle && <span className="fit-entry__sub">{item.subtitle}</span>}
        </p>
      )}
      {period(item) && <p className="fit-entry__period">{period(item)}</p>}
      {item.lines.length > 0 && (
        <ul className="fit-entry__lines">
          {item.lines.map((line, index) => <li key={index}>{line}</li>)}
        </ul>
      )}
    </li>
  )
}

function Section({ section }) {
  const count = section.items.length
  // Mục có nhiều mục con (công việc, bằng cấp…) ghi số lượng cạnh tiêu đề.
  const countable = count > 1 || Boolean(section.items[0]?.title)
  return (
    <section className="fit-section">
      <h4 className="fit-section__title">
        {SECTION_LABELS[section.key]?.() || section.key}
        {countable && <span className="fit-section__count">{count}</span>}
      </h4>
      <ul className="fit-section__items">
        {section.items.map((item, index) => <SectionItem key={index} item={item} />)}
      </ul>
    </section>
  )
}

/**
 * Hồ sơ trích xuất từ một CV (`public_cv_profile` của backend): chức danh, các số liệu tóm
 * tắt, kỹ năng nhận ra theo danh mục và nội dung đầy đủ từng mục của CV (tóm tắt, từng công
 * việc kèm mô tả, dự án, học vấn, chứng chỉ, ngoại ngữ…). Chỉ đọc. Dùng cho ứng viên xem
 * trước "hồ sơ NTD nhìn thấy" và cho nhà tuyển dụng (hồ sơ ứng tuyển, Tìm CV).
 */
export default function ExtractedProfile({ profile }) {
  const { experience } = profile
  const groups = profile.skill_groups.filter((group) => group.skills.length)
  const sections = profile.sections || []
  return (
    <div className="fit-profile">
      <p className="fit-profile__title">{profile.title || m.fit_profile_title_unknown()}</p>
      <dl className="fit-facts">
        <Fact label={m.fit_criterion_experience()}>
          {experience.months != null && (
            <>
              {durationText(experience.months)}
              {experience.estimated && <span className="fit-tag">{m.fit_profile_estimated()}</span>}
            </>
          )}
        </Fact>
        <Fact label={m.fit_criterion_education()}>{educationLevelLabel(profile.education_level)}</Fact>
        <Fact label={m.fit_criterion_position_level()}>{positionLevelLabel(profile.position_level)}</Fact>
        <Fact label={m.fit_criterion_languages()}>
          {profile.languages.length > 0 && profile.languages
            .map((row) => [languageLabel(row.code), languageLevelLabel(row.level)].filter(Boolean).join(' · '))
            .join(', ')}
        </Fact>
      </dl>

      {groups.length > 0 && (
        <section className="fit-section">
          <h4 className="fit-section__title">
            {m.fit_profile_skills_heading()}
            <span className="fit-section__count">{groups.reduce((total, group) => total + group.skills.length, 0)}</span>
          </h4>
          {groups.map((group) => (
            <div key={group.group || 'other'} className="fit-profile__group">
              {group.group && <p className="fit-profile__group-name">{group.group}</p>}
              <ul className="fit-chips">
                {group.skills.map((name) => <li key={name} className="fit-missing">{name}</li>)}
              </ul>
            </div>
          ))}
        </section>
      )}

      {sections.map((section) => <Section key={section.key} section={section} />)}
      {sections.length === 0 && <p className="fit-empty">{m.fit_profile_sections_empty()}</p>}
    </div>
  )
}
