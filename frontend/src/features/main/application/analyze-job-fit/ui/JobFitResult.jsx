import { CheckOutlined, CloseOutlined, InfoCircleOutlined, MinusOutlined } from '@ant-design/icons'
import { ProcvMascot } from '@/shared/ui/mascot'
import { CONFIDENCE_COPY, CRITERIA_LABELS, FIT_BANDS, STATUS_COPY, bandOf } from '../model/job-fit'
import { useCountUp, useRevealed } from './use-reveal'

// Mascot theo mức: mừng khi rất phù hợp, nghĩ ngợi khi còn thiếu nhiều.
const MASCOT_BY_BAND = {
  very_high: { emotion: 'success', pose: 'thumbsUp' },
  high: { emotion: 'happy', pose: 'neutral' },
  medium: { emotion: 'thinking', pose: 'checklist' },
  low: { emotion: 'thinking', pose: 'neutral' },
}

const REQUIREMENT_ICONS = {
  met: { icon: <CheckOutlined />, label: 'Đạt' },
  partial: { icon: <MinusOutlined />, label: 'Một phần' },
  unmet: { icon: <CloseOutlined />, label: 'Chưa thấy trong CV' },
}

// Thước bốn dải: vị trí điểm so với các mốc 50 / 65 / 80. Chỉ ghi nhãn của mức
// hiện tại (dải 50–64 hẹp, ghi cả bốn nhãn sẽ đè nhau); ranh giới ghi bằng số.
function FitScale({ score, revealed }) {
  const current = bandOf(score)
  return (
    <div className="jf-scale" role="img" aria-label={`${score} điểm, mức ${current.label}`}>
      <div className="jf-scale__track">
        {FIT_BANDS.map((band, index) => {
          const to = FIT_BANDS[index + 1]?.from ?? 100
          return (
            <span
              key={band.key}
              className={`jf-scale__band jf-scale__band--${band.key}${band.key === current.key ? ' is-current' : ''}`}
              style={{ flexGrow: to - band.from }}
            >
              {band.from > 0 && <span className="jf-scale__tick">{band.from}</span>}
            </span>
          )
        })}
        <span className="jf-scale__marker" style={{ left: revealed ? `${Math.min(Math.max(score, 1), 99)}%` : '0%' }} />
      </div>
    </div>
  )
}

function Criterion({ component, order, revealed }) {
  const label = CRITERIA_LABELS[component.key] || component.key
  const scored = component.status === 'ok'
  return (
    <li className="jf-criterion">
      <div className="jf-criterion__head">
        <span className="jf-criterion__name">{label}</span>
        <span className={scored ? 'jf-criterion__score' : 'jf-criterion__status'}>
          {scored ? component.score : STATUS_COPY[component.status]}
        </span>
      </div>
      {scored && (
        <span className="jf-meter" aria-hidden="true">
          <span style={{ width: revealed ? `${component.score}%` : 0, transitionDelay: `${order * 90}ms` }} />
        </span>
      )}
      {component.summary && <p className="jf-criterion__summary">{component.summary}</p>}
    </li>
  )
}

function MatchedSkill({ skill }) {
  return (
    <li className="jf-skill">
      <span className="jf-skill__name">
        {skill.name}
        {skill.importance === 'preferred' && <span className="jf-tag">nên có</span>}
        {skill.match_type === 'semantic' && <span className="jf-tag">viết khác tên</span>}
        {!skill.evidence && <span className="jf-tag jf-tag--warn">chỉ liệt kê</span>}
      </span>
      {skill.evidence && <q className="jf-quote">{skill.evidence}</q>}
    </li>
  )
}

export default function JobFitResult({ result }) {
  const { overall, components, skills, requirements, suggestions } = result
  const band = bandOf(overall.score)
  const shownScore = useCountUp(overall.score)
  const revealed = useRevealed()
  const reached = requirements.filter((row) => row.status !== 'unmet')

  return (
    <div className="jf-result">
      <section className="jf-verdict" aria-labelledby="jf-verdict-title">
        <span className="jf-verdict__mascot">
          <ProcvMascot blink {...MASCOT_BY_BAND[band.key]} size={84} />
        </span>
        <div className="jf-verdict__main">
          <div className="jf-verdict__row">
            <p id="jf-verdict-title" className={`jf-verdict__label jf-verdict__label--${band.key}`}>
              {overall.label}
            </p>
            <p className="jf-verdict__score">
              <strong>{shownScore}</strong>
              <span>/100</span>
            </p>
          </div>
          <FitScale score={overall.score} revealed={revealed} />
        </div>
        <p className="jf-note">
          <InfoCircleOutlined aria-hidden="true" /> {result.disclaimer} {CONFIDENCE_COPY[overall.confidence]}
        </p>
      </section>

      <section aria-labelledby="jf-criteria-title">
        <h3 id="jf-criteria-title" className="jf-heading">Theo từng tiêu chí</h3>
        <ul className="jf-criteria">
          {components.map((component, order) => (
            <Criterion key={component.key} component={component} order={order} revealed={revealed} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="jf-skills-title">
        <h3 id="jf-skills-title" className="jf-heading">Kỹ năng tin yêu cầu</h3>
        <div className="jf-skills">
          <div>
            <p className="jf-subheading">Có trong CV ({skills.matched.length})</p>
            {skills.matched.length ? (
              <ul className="jf-list">{skills.matched.map((skill) => <MatchedSkill key={skill.name} skill={skill} />)}</ul>
            ) : <p className="jf-empty">Chưa thấy kỹ năng nào của tin trong CV.</p>}
          </div>
          <div>
            <p className="jf-subheading">Còn thiếu ({skills.missing.length})</p>
            {skills.missing.length ? (
              <ul className="jf-chips">
                {skills.missing.map((skill) => (
                  <li key={skill.name} className={`jf-chip${skill.importance === 'required' ? ' jf-chip--required' : ''}`}>
                    {skill.name}{skill.importance === 'required' ? '' : ' (nên có)'}
                  </li>
                ))}
              </ul>
            ) : <p className="jf-empty">CV có đủ kỹ năng tin liệt kê.</p>}
          </div>
        </div>
      </section>

      {requirements.length > 0 && (
        <section aria-labelledby="jf-requirements-title">
          <h3 id="jf-requirements-title" className="jf-heading">
            Yêu cầu của tin: CV nói tới {reached.length}/{requirements.length}
          </h3>
          <ul className="jf-list">
            {requirements.map((row, index) => (
              <li key={`${index}-${row.text}`} className={`jf-requirement jf-requirement--${row.status}`}>
                <span className="jf-requirement__icon" aria-label={REQUIREMENT_ICONS[row.status].label}>
                  {REQUIREMENT_ICONS[row.status].icon}
                </span>
                <span className="jf-requirement__body">
                  <span>{row.text}</span>
                  {row.evidence && <q className="jf-quote">{row.evidence}</q>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {suggestions.length > 0 && (
        <section aria-labelledby="jf-suggestions-title">
          <h3 id="jf-suggestions-title" className="jf-heading">Gợi ý cho CV</h3>
          <ul className="jf-suggestions">
            {suggestions.map((item) => (
              <li key={item.code} className={`jf-suggestion jf-suggestion--${item.priority}`}>{item.message}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
