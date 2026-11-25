import { RightOutlined } from '@ant-design/icons'
import { lazy, Suspense, useState } from 'react'
import { FitScoreChip } from '@/entities/application/job-fit'
import { m } from '@/shared/config/i18n'

const ApplicationMatchDrawer = lazy(() => import('./ApplicationMatchDrawer'))

/** Khối "Mức độ phù hợp (AI)" đặt đầu panel hồ sơ: điểm, mức và nút xem vì sao. */
export default function ApplicationMatchCard({ application }) {
  const [open, setOpen] = useState(false)
  if (!application.ai_match_status) return null
  return (
    <section className="fit-card" aria-labelledby="application-match-title">
      <div className="fit-card__head">
        <h3 id="application-match-title">{m.employer_workspace_app_fit_title()}</h3>
        <FitScoreChip
          status={application.ai_match_status}
          score={application.ai_match_score}
          level={application.ai_match_level}
        />
      </div>
      <button type="button" className="fit-card__link" onClick={() => setOpen(true)}>
        {m.employer_workspace_match_why()} <RightOutlined aria-hidden />
      </button>
      {open && (
        <Suspense fallback={null}>
          <ApplicationMatchDrawer application={application} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </section>
  )
}
