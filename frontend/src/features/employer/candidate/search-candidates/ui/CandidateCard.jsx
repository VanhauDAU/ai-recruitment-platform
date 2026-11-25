import {
  AimOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import {
  durationText,
  educationLevelLabel,
  fitLevelLabel,
  languageLabel,
  languageLevelLabel,
  positionLevelLabel,
} from '@/entities/application/job-fit'
import { m } from '@/shared/config/i18n'
import { formatTimeAgo } from '@/shared/lib/date-time'
import { candidateStateLabel } from '../model/invitation-state'

const RING = 2 * Math.PI * 21

// Nhãn ngoại ngữ dùng chung viết thường để ghép trong câu ("tiếng Anh"); đầu dòng thì viết hoa.
function capitalize(text) {
  return text.charAt(0).toLocaleUpperCase('vi') + text.slice(1)
}

// 'YYYY-MM' → 'MM/YYYY'.
function month(value) {
  const [year, part] = String(value).split('-')
  return part ? `${part}/${year}` : String(value)
}

function period(item) {
  if (!item.start) return item.end ? month(item.end) : ''
  return `${month(item.start)} – ${item.end ? month(item.end) : m.fit_profile_present()}`
}

/** Vòng điểm phù hợp ở chỗ avatar: danh tính bị ẩn nên điểm là thứ nhận diện thẻ. */
function ScoreRing({ score, level }) {
  const label = m.fit_chip_ready_hint({ score, label: fitLevelLabel(level) })
  return (
    <div className="cs-ring" data-level={level} role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 48 48" aria-hidden>
        <circle className="cs-ring__track" cx="24" cy="24" r="21" />
        <circle
          className="cs-ring__value"
          cx="24"
          cy="24"
          r="21"
          strokeDasharray={`${(RING * score) / 100} ${RING}`}
        />
      </svg>
      <strong>{score}</strong>
    </div>
  )
}

function Fact({ icon, children }) {
  if (!children) return null
  return <li>{icon}<span>{children}</span></li>
}

function Block({ heading, children }) {
  return (
    <section className="cs-block">
      <h4>{heading}</h4>
      {children}
    </section>
  )
}

export default function CandidateCard({ candidate, selected, selectable, onSelect, onOpen }) {
  const titleId = `cs-card-${candidate.ref}`
  const stateLabel = candidateStateLabel(candidate)
  const hiddenJobs = candidate.experience_count - candidate.experience.length
  const months = candidate.experience_months
  return (
    <li className="cs-card" data-selected={selected || undefined} aria-labelledby={titleId}>
      <input
        type="checkbox"
        className="cs-check"
        checked={selected}
        disabled={!selectable}
        onChange={(event) => onSelect(candidate.ref, event.target.checked)}
        aria-label={m.employer_workspace_search_select_one({ code: candidate.code })}
      />
      <div className="cs-card__who">
        <ScoreRing score={candidate.score} level={candidate.level} />
        <div className="cs-card__id">
          <h3 id={titleId} className="cs-card__title">
            <button type="button" onClick={() => onOpen(candidate)}>
              {candidate.title || m.employer_workspace_search_title_unknown()}
            </button>
          </h3>
          <p className="cs-card__code">
            {candidate.code}
            {stateLabel && (
              <span className="cs-state" data-state={candidate.applied ? 'applied' : candidate.invitation_status}>
                {stateLabel}
              </span>
            )}
          </p>
        </div>
        <ul className="cs-facts">
          <Fact icon={<RiseOutlined aria-hidden />}>{positionLevelLabel(candidate.position_level)}</Fact>
          <Fact icon={<AimOutlined aria-hidden />}>
            {candidate.desired_positions.length > 0
              && m.employer_workspace_search_wants({ positions: candidate.desired_positions.join(', ') })}
          </Fact>
          <Fact icon={<EnvironmentOutlined aria-hidden />}>{candidate.provinces.join(', ')}</Fact>
          <Fact icon={<ClockCircleOutlined aria-hidden />}>
            {candidate.cv_updated_at
              && m.employer_workspace_search_updated({ time: formatTimeAgo(candidate.cv_updated_at, undefined, { inSentence: true }) })}
          </Fact>
        </ul>
      </div>

      <div className="cs-card__body">
        <Block
          heading={months != null && months > 0
            ? m.employer_workspace_search_experience_heading({ duration: durationText(months) })
            : m.fit_profile_section_experience()}
        >
          {candidate.experience.length > 0 ? (
            <ol className="cs-timeline">
              {candidate.experience.map((item, index) => (
                <li key={index}>
                  <span className="cs-timeline__when">{period(item) || m.fit_profile_unknown()}</span>
                  <span className="cs-timeline__what">{item.title}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="cs-muted">
              {months === 0 ? m.employer_workspace_search_no_experience() : m.employer_workspace_search_no_timeline()}
            </p>
          )}
          {hiddenJobs > 0 && (
            <button type="button" className="cs-link" onClick={() => onOpen(candidate)}>
              {m.employer_workspace_search_more_jobs({ count: hiddenJobs })}
            </button>
          )}
        </Block>
        <div className="cs-card__pair">
          <Block heading={m.fit_profile_section_education()}>
            {candidate.education.length > 0 ? (
              <ul className="cs-lines">
                {candidate.education.map((item, index) => (
                  <li key={index}>{[item.title, item.subtitle].filter(Boolean).join(' – ')}</li>
                ))}
              </ul>
            ) : (
              <p className="cs-muted">{educationLevelLabel(candidate.education_level) || m.fit_profile_unknown()}</p>
            )}
          </Block>
          <Block heading={m.fit_profile_section_languages()}>
            {candidate.languages.length > 0 ? (
              <ul className="cs-lines">
                {candidate.languages.map((item) => (
                  <li key={item.code}>
                    {capitalize([languageLabel(item.code), languageLevelLabel(item.level)].filter(Boolean).join(' – '))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cs-muted">{m.fit_profile_unknown()}</p>
            )}
          </Block>
        </div>
        {candidate.matched_skills.length > 0 && (
          <div className="cs-skills">
            <span>
              {m.employer_workspace_search_matched_skills({
                matched: candidate.matched_skill_count,
                total: candidate.job_skill_count,
              })}
            </span>
            <ul>
              {candidate.matched_skills.map((skill) => <li key={skill}>{skill}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="cs-card__actions">
        <button type="button" className="cs-btn" onClick={() => onOpen(candidate)}>
          {m.employer_workspace_search_details()}
        </button>
      </div>
    </li>
  )
}
