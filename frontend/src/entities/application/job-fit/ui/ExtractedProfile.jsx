import { m } from '@/shared/config/i18n'
import {
  durationText,
  educationLevelLabel,
  languageLabel,
  languageLevelLabel,
  positionLevelLabel,
} from '../model/job-fit'
import './job-fit.css'

function Fact({ label, children }) {
  return (
    <div className="fit-fact">
      <dt>{label}</dt>
      <dd>{children || m.fit_profile_unknown()}</dd>
    </div>
  )
}

function period(item) {
  if (!item.start_date) return ''
  return `${item.start_date} – ${item.end_date || m.fit_profile_present()}`
}

function ExperienceItems({ experience }) {
  const { items = [], item_count: count = 0 } = experience
  if (items.length) {
    return (
      <ul className="fit-profile__items">
        {items.map((item, index) => (
          <li key={index}>
            {item.text ? item.text : (
              <>
                <strong>{item.role || m.fit_profile_role_unknown()}</strong>
                {item.company && <span> · {item.company}</span>}
                {period(item) && <span className="fit-profile__period">{period(item)}</span>}
              </>
            )}
          </li>
        ))}
      </ul>
    )
  }
  return count ? <p className="fit-empty">{m.fit_profile_experience_count({ count })}</p> : null
}

/**
 * Hồ sơ trích xuất từ một CV (`public_cv_profile` của backend): chức danh, kinh nghiệm,
 * học vấn, cấp bậc, ngoại ngữ, kỹ năng theo nhóm. Chỉ đọc. Dùng cho ứng viên xem trước
 * "hồ sơ NTD nhìn thấy" và cho nhà tuyển dụng khi tìm ứng viên.
 */
export default function ExtractedProfile({ profile }) {
  const { experience } = profile
  const groups = profile.skill_groups.filter((group) => group.skills.length)
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

      <div>
        <p className="fit-subheading">{m.fit_profile_experience_heading()}</p>
        <ExperienceItems experience={experience} />
        {!experience.item_count && <p className="fit-empty">{m.fit_profile_experience_empty()}</p>}
      </div>

      <div>
        <p className="fit-subheading">{m.fit_profile_skills_heading()}</p>
        {groups.length ? groups.map((group) => (
          <div key={group.group || 'other'} className="fit-profile__group">
            {group.group && <p className="fit-profile__group-name">{group.group}</p>}
            <ul className="fit-chips">
              {group.skills.map((name) => <li key={name} className="fit-missing">{name}</li>)}
            </ul>
          </div>
        )) : <p className="fit-empty">{m.fit_profile_skills_empty()}</p>}
      </div>
    </div>
  )
}
