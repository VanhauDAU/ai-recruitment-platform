import { CheckOutlined, CloseOutlined, DownOutlined, InfoCircleOutlined, MinusOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { m } from '@/shared/config/i18n'
import { ProcvMascot } from '@/shared/ui/mascot'
import {
  FIT_BANDS,
  bandOf,
  confidenceLabel,
  criterionLabel,
  criterionStatusLabel,
  groupMissingSkills,
} from '@/entities/application/job-fit'
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
  partial: { icon: <MinusOutlined />, label: 'Có liên quan, chưa rõ' },
  unmet: { icon: <CloseOutlined />, label: 'Chưa thấy trong CV' },
}

// Thước bốn dải: vị trí điểm so với các mốc 50 / 65 / 80. Chỉ ghi nhãn của mức
// hiện tại (dải 50–64 hẹp, ghi cả bốn nhãn sẽ đè nhau); ranh giới ghi bằng số.
function FitScale({ score, revealed }) {
  const current = bandOf(score)
  return (
    <div className="jf-scale" role="img" aria-label={`${score} điểm, mức ${current.label()}`}>
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

// Một tiêu chí là một dòng: tên, thanh điểm, số. Câu giải thích mở ra khi bấm; tiêu chí
// yếu nhất mở sẵn vì đó là chỗ người xem cần đọc trước.
function Criterion({ component, order, revealed, open }) {
  const scored = component.status === 'ok'
  return (
    <li>
      <details className="jf-criterion" open={open}>
        <summary className="jf-criterion__head">
          <span className="jf-criterion__name">{criterionLabel(component.key)}</span>
          {scored ? (
            <span className="jf-meter" aria-hidden="true">
              <span style={{ width: revealed ? `${component.score}%` : 0, transitionDelay: `${order * 90}ms` }} />
            </span>
          ) : <span className="jf-criterion__status">{criterionStatusLabel(component.status)}</span>}
          {scored && <span className="jf-criterion__score">{component.score}</span>}
          <DownOutlined className="jf-criterion__caret" aria-hidden="true" />
        </summary>
        {component.summary && <p className="jf-criterion__summary">{component.summary}</p>}
      </details>
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

// Mô hình đã chấm: bi-encoder, kèm cross-encoder phán từng yêu cầu nếu có. Kết quả cũ không
// ghi `meta` thì không hiện.
function modelNames(meta = {}) {
  return [meta.model_version, meta.reranker_version].filter(Boolean).join(' + ')
}

function Overview({ result, revealed, onShowSuggestions }) {
  const { overall, components, suggestions } = result
  const scores = components.filter((component) => component.status === 'ok').map((component) => component.score)
  const weakest = Math.min(...scores)
  const first = suggestions.find((item) => item.priority === 'high') || suggestions[0]
  return (
    <>
      <ul className="jf-criteria">
        {components.map((component, order) => (
          <Criterion
            key={component.key}
            component={component}
            order={order}
            revealed={revealed}
            open={component.status === 'ok' && component.score === weakest && weakest < 80}
          />
        ))}
      </ul>
      {first && (
        <div className={`jf-next jf-suggestion--${first.priority}`}>
          <p className="jf-next__title">{m.candidate_job_fit_next_step()}</p>
          <p className="jf-next__text">{first.message}</p>
          {suggestions.length > 1 && (
            <button type="button" className="jf-textlink" onClick={onShowSuggestions}>
              {m.candidate_job_fit_all_suggestions({ count: suggestions.length })}
            </button>
          )}
        </div>
      )}
      <p className="jf-note">
        <InfoCircleOutlined aria-hidden="true" /> {result.disclaimer} {confidenceLabel(overall.confidence)}
      </p>
    </>
  )
}

function Skills({ skills, missing }) {
  return (
    <div className="jf-skills">
      <div>
        <p className="jf-subheading">Có trong CV ({skills.matched.length})</p>
        {skills.matched.length ? (
          <ul className="jf-list">{skills.matched.map((skill) => <MatchedSkill key={skill.name} skill={skill} />)}</ul>
        ) : <p className="jf-empty">Chưa thấy kỹ năng nào của tin trong CV.</p>}
      </div>
      <div>
        <p className="jf-subheading">Còn thiếu ({missing.length})</p>
        {missing.length ? (
          <ul className="jf-chips">
            {missing.map((skill) => (
              <li key={skill.key} className={`jf-chip${skill.importance === 'required' ? ' jf-chip--required' : ''}`}>
                {skill.names.join(' hoặc ')}{skill.importance === 'required' ? '' : ' (nên có)'}
              </li>
            ))}
          </ul>
        ) : <p className="jf-empty">CV có đủ kỹ năng tin liệt kê.</p>}
      </div>
    </div>
  )
}

function Requirements({ requirements, reached }) {
  return (
    <>
      <p className="jf-subheading">Yêu cầu của tin: CV nói tới {reached}/{requirements.length}</p>
      <ul className="jf-legend" aria-hidden="true">
        {Object.entries(REQUIREMENT_ICONS).map(([status, { icon, label }]) => (
          <li key={status} className={`jf-requirement--${status}`}><span className="jf-requirement__icon">{icon}</span>{label}</li>
        ))}
      </ul>
      <ul className="jf-list">
        {requirements.map((row, index) => (
          <li key={`${index}-${row.text}`} className={`jf-requirement jf-requirement--${row.status}`}>
            <span className="jf-requirement__icon" role="img" aria-label={REQUIREMENT_ICONS[row.status].label}>
              {REQUIREMENT_ICONS[row.status].icon}
            </span>
            <span className="jf-requirement__body">
              <span>{row.text}</span>
              {row.evidence && <q className="jf-quote">{row.evidence}</q>}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * Kết quả trong một khung cao cố định: kết luận và thanh tab luôn hiện, chỉ nội dung tab
 * cuộn, chân khung ghi mô hình đã chấm và nhận nút hành động (`actions`) từ hộp thoại.
 */
export default function JobFitResult({ result, actions }) {
  const { overall, components, skills, requirements, suggestions } = result
  const [tab, setTab] = useState('overview')
  const band = bandOf(overall.score)
  const shownScore = useCountUp(overall.score)
  const revealed = useRevealed()
  const reached = requirements.filter((row) => row.status !== 'unmet').length
  const missing = groupMissingSkills(skills.missing)
  const units = components.find((component) => component.key === 'skills')?.detail?.units
    || { met: skills.matched.length, total: skills.matched.length + missing.length }
  const models = modelNames(result.meta)
  const tabs = [
    { key: 'overview', label: m.candidate_job_fit_tab_overview() },
    { key: 'skills', label: m.candidate_job_fit_tab_skills(), count: units.total ? `${units.met}/${units.total}` : '' },
    requirements.length > 0 && { key: 'requirements', label: m.candidate_job_fit_tab_requirements(), count: `${reached}/${requirements.length}` },
    suggestions.length > 0 && { key: 'suggestions', label: m.candidate_job_fit_tab_suggestions(), count: suggestions.length },
  ].filter(Boolean)

  function handleKeyDown(event) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!step) return
    const next = tabs[(tabs.findIndex((item) => item.key === tab) + step + tabs.length) % tabs.length].key
    setTab(next)
    document.getElementById(`jf-tab-${next}`)?.focus()
  }

  return (
    <div className="jf-result">
      <section className="jf-verdict" aria-labelledby="jf-verdict-title">
        <span className="jf-verdict__mascot">
          <ProcvMascot blink {...MASCOT_BY_BAND[band.key]} size={64} />
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
      </section>

      <div role="tablist" aria-label={m.candidate_job_fit_tabs_label()} className="jf-tabs" onKeyDown={handleKeyDown}>
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`jf-tab-${item.key}`}
            aria-selected={tab === item.key}
            aria-controls="jf-tabpanel"
            tabIndex={tab === item.key ? 0 : -1}
            onClick={() => setTab(item.key)}
            className="jf-tabs__tab"
          >
            {item.label}
            {item.count !== undefined && item.count !== '' && <span className="jf-tabs__count">{item.count}</span>}
          </button>
        ))}
      </div>

      <div key={tab} role="tabpanel" id="jf-tabpanel" aria-labelledby={`jf-tab-${tab}`} tabIndex={0} className="jf-panel">
        {tab === 'overview' && <Overview result={result} revealed={revealed} onShowSuggestions={() => setTab('suggestions')} />}
        {tab === 'skills' && <Skills skills={skills} missing={missing} />}
        {tab === 'requirements' && <Requirements requirements={requirements} reached={reached} />}
        {tab === 'suggestions' && (
          <ul className="jf-suggestions">
            {suggestions.map((item) => (
              <li key={item.code} className={`jf-suggestion jf-suggestion--${item.priority}`}>{item.message}</li>
            ))}
          </ul>
        )}
      </div>

      {(models || actions) && (
        <footer className="jf-foot">
          {models && <p className="jf-model">{m.candidate_job_fit_model({ models })}</p>}
          {actions}
        </footer>
      )}
    </div>
  )
}
