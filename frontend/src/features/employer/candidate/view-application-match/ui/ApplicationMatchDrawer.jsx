import { useQuery } from '@tanstack/react-query'
import { Button, Drawer, Grid, Skeleton } from 'antd'
import { applicationKeys, getRecruiterApplicationMatch } from '@/entities/application/application'
import { FitBreakdown } from '@/entities/application/job-fit'
import { m } from '@/shared/config/i18n'

const POLL_MS = 5000
const FAILED_COPY = {
  cv_text_unavailable: () => m.employer_workspace_app_fit_failed_cv(),
  cv_insufficient_content: () => m.employer_workspace_app_fit_failed_cv(),
  job_text_too_short: () => m.employer_workspace_app_fit_failed_job(),
}

function Note({ children }) {
  return <p className="fit-drawer__note">{children}</p>
}

/**
 * Giải thích mức phù hợp của một hồ sơ: điểm tổng, từng tiêu chí kèm lý do, kỹ năng có và
 * còn thiếu kèm câu trích từ CV đã nộp, và cách tính điểm. Đang phân tích thì hỏi lại mỗi 5 giây.
 */
export default function ApplicationMatchDrawer({ application, onClose }) {
  const wide = Grid.useBreakpoint().md
  const matchQuery = useQuery({
    queryKey: applicationKeys.recruiterMatch(application.public_id),
    queryFn: () => getRecruiterApplicationMatch(application.public_id),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? POLL_MS : false),
  })
  const match = matchQuery.data
  const name = application.candidate_name || application.candidate_email || ''

  return (
    <Drawer
      open
      onClose={onClose}
      placement={wide ? 'right' : 'bottom'}
      size={wide ? 520 : '92%'}
      title={m.employer_workspace_match_title({ name })}
    >
      <p className="fit-drawer__job">{m.employer_workspace_match_job({ job: application.job_title || '' })}</p>
      {matchQuery.isLoading && <Skeleton active paragraph={{ rows: 8 }} />}
      {matchQuery.isError && (
        <Note>
          {m.employer_workspace_app_fit_load_failed()}{' '}
          <Button type="link" size="small" className="!p-0" onClick={() => matchQuery.refetch()}>
            {m.employer_workspace_app_fit_retry()}
          </Button>
        </Note>
      )}
      {match?.status === 'pending' && <Note>{m.employer_workspace_app_fit_pending()}</Note>}
      {match?.status === 'not_consented' && <Note>{m.employer_workspace_app_fit_not_consented()}</Note>}
      {match?.status === 'failed' && (
        <Note>{m.employer_workspace_app_fit_failed()} {FAILED_COPY[match.error_code]?.() || ''}</Note>
      )}
      {match?.status === 'ready' && match.result && (
        <>
          <FitBreakdown result={match.result} />
          <section className="fit-drawer__how" aria-labelledby="match-how-title">
            <h3 id="match-how-title">{m.employer_workspace_match_how_title()}</h3>
            <ul>
              <li>{m.employer_workspace_match_how_weights()}</li>
              <li>{m.employer_workspace_match_how_source()}</li>
              <li>{m.employer_workspace_match_how_relevance()}</li>
              <li>{m.employer_workspace_app_fit_disclaimer()}</li>
            </ul>
          </section>
        </>
      )}
    </Drawer>
  )
}
