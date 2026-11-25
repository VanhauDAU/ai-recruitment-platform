import { m } from '@/shared/config/i18n'
import { fitLevelLabel } from '../model/job-fit'
import './job-fit.css'

const PENDING_COPY = {
  pending: { label: () => m.fit_chip_pending(), hint: () => m.fit_chip_pending_hint() },
  not_consented: { label: () => m.fit_chip_not_consented(), hint: () => m.fit_chip_not_consented_hint() },
  failed: { label: () => m.fit_chip_failed(), hint: () => m.fit_chip_failed_hint() },
}

/**
 * Mức phù hợp của một hồ sơ trên một dòng: điểm + mức, hoặc lý do chưa có điểm.
 * `status` rỗng (tính năng tắt) thì không hiện gì.
 */
export default function FitScoreChip({ status, score, level, className = '' }) {
  if (!status) return null
  if (status !== 'ready') {
    const copy = PENDING_COPY[status] || PENDING_COPY.pending
    return (
      <span className={`fit-chip fit-chip--muted ${className}`} title={copy.hint()}>
        {copy.label()}
      </span>
    )
  }
  const label = fitLevelLabel(level)
  return (
    <span className={`fit-chip fit-chip--${level} ${className}`} title={m.fit_chip_ready_hint({ score, label })}>
      <strong>{score}</strong>
      <span>{label}</span>
    </span>
  )
}
