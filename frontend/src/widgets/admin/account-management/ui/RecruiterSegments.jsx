import { Skeleton } from 'antd'
import { getIntlLocale } from '@/shared/config/i18n'
import { RECRUITER_SEGMENTS } from '../model/recruiter-segments'

const formatCount = (value) => Number(value || 0).toLocaleString(getIntlLocale())

/** Clickable KPI tiles (dashboard style) that double as saved views. */
export default function RecruiterSegments({ active, loading, onSelect, summary = {} }) {
  return (
    <section className="recruiter-segments" aria-label="Tổng quan nhà tuyển dụng">
      {RECRUITER_SEGMENTS.map((segment) => {
        const value = Number(segment.count(summary) || 0)
        const tone = value > 0 ? segment.tone : undefined
        return (
          <button
            aria-pressed={active === segment.key}
            className={`recruiter-segment${tone ? ` recruiter-segment--${tone}` : ''}`}
            key={segment.key}
            onClick={() => onSelect(segment.key)}
            type="button"
          >
            <span className="recruiter-segment__label">{segment.label}</span>
            {loading
              ? <Skeleton.Input active size="small" className="recruiter-segment__skeleton" />
              : <strong className="recruiter-segment__value">{formatCount(value)}</strong>}
            <span className="recruiter-segment__hint">{segment.hint}</span>
          </button>
        )
      })}
    </section>
  )
}
