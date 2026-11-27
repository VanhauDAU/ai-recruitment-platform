import { m } from '@/shared/config/i18n'
import {
  confidenceLabel,
  criterionLabel,
  criterionStatusLabel,
  criterionSummary,
  fitLevelLabel,
  groupMissingSkills,
} from '../model/job-fit'
import './job-fit.css'

function Criterion({ component }) {
  const scored = component.status === 'ok'
  // Kết quả của ứng viên mang sẵn `summary`; bản cho nhà tuyển dụng dựng từ `detail`.
  const summary = component.summary || criterionSummary(component)
  return (
    <li className="fit-criterion">
      <div className="fit-criterion__head">
        <span>{criterionLabel(component.key)}</span>
        <span className={scored ? 'fit-criterion__score' : 'fit-criterion__status'}>
          {scored ? component.score : criterionStatusLabel(component.status)}
        </span>
      </div>
      {scored && (
        <span className="fit-meter" aria-hidden="true">
          <span style={{ width: `${component.score}%` }} />
        </span>
      )}
      {summary && <p className="fit-criterion__summary">{summary}</p>}
    </li>
  )
}

/**
 * Chi tiết mức phù hợp của một CV với một tin: điểm tổng, từng tiêu chí, kỹ năng có và
 * còn thiếu (kèm câu trích nguyên văn của CV). Bản gọn, một cột, cho panel hẹp.
 * `showEvidence={false}` cho kết quả ẩn danh (Tìm CV): không có câu trích để hiện.
 */
export default function FitBreakdown({ result, showEvidence = true }) {
  const { overall, components, skills, flags = {} } = result
  const missing = groupMissingSkills(skills.missing)
  const notes = [
    confidenceLabel(overall.confidence),
    flags.relevance_discount_applied && m.fit_note_relevance_discount(),
    flags.language_cap_applied && m.fit_note_language_cap(),
    flags.experience_estimated && m.fit_note_experience_estimated(),
  ].filter(Boolean)

  return (
    <div className="fit-breakdown">
      <div className="fit-verdict">
        <p className="fit-verdict__score">
          <strong>{overall.score}</strong>
          <span>/100</span>
        </p>
        <div className="fit-verdict__main">
          <p className={`fit-verdict__label fit-verdict__label--${overall.level}`}>{fitLevelLabel(overall.level)}</p>
          <span className="fit-meter fit-meter--lg" role="img" aria-label={m.fit_score_aria({ score: overall.score })}>
            <span style={{ width: `${overall.score}%` }} />
          </span>
        </div>
      </div>

      <ul className="fit-criteria">
        {components.map((component) => <Criterion key={component.key} component={component} />)}
      </ul>

      <div>
        <p className="fit-subheading">{m.fit_skills_matched({ count: skills.matched.length })}</p>
        {skills.matched.length ? (
          <ul className="fit-skills">
            {skills.matched.map((skill) => (
              <li key={skill.name}>
                <span className="fit-skill__name">
                  {skill.name}
                  {skill.importance === 'preferred' && <span className="fit-tag">{m.fit_skill_preferred()}</span>}
                  {showEvidence && !skill.evidence && <span className="fit-tag">{m.fit_skill_listed_only()}</span>}
                </span>
                {showEvidence && skill.evidence && <q className="fit-quote">{skill.evidence}</q>}
              </li>
            ))}
          </ul>
        ) : <p className="fit-empty">{m.fit_skills_matched_empty()}</p>}
      </div>

      {missing.length > 0 && (
        <div>
          <p className="fit-subheading">{m.fit_skills_missing({ count: missing.length })}</p>
          <ul className="fit-chips">
            {missing.map((skill) => (
              <li key={skill.key} className={skill.importance === 'required' ? 'fit-missing fit-missing--required' : 'fit-missing'}>
                {skill.names.join(' / ')}
                {skill.importance !== 'required' && ` (${m.fit_skill_preferred()})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes.length > 0 && <p className="fit-note">{notes.join(' ')}</p>}
    </div>
  )
}
