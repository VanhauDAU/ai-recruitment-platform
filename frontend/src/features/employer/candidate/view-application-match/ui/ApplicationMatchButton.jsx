import { lazy, Suspense, useState } from 'react'
import { FitScoreChip } from '@/entities/application/job-fit'
import { m } from '@/shared/config/i18n'

const ApplicationMatchDrawer = lazy(() => import('./ApplicationMatchDrawer'))

/**
 * Mức phù hợp của một hồ sơ trên một dòng; bấm vào mở bảng giải thích vì sao có điểm đó.
 * Không hiện gì khi tính năng tắt (`ai_match_status` rỗng).
 */
export default function ApplicationMatchButton({ application }) {
  const [open, setOpen] = useState(false)
  if (!application.ai_match_status) return null
  return (
    <>
      <button
        type="button"
        className="fit-chip-button"
        aria-label={m.employer_workspace_match_open_aria()}
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <FitScoreChip
          status={application.ai_match_status}
          score={application.ai_match_score}
          level={application.ai_match_level}
        />
      </button>
      {open && (
        <Suspense fallback={null}>
          <ApplicationMatchDrawer application={application} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
