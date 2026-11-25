import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from 'antd'
import { applicationKeys, getRecruiterApplicationMatch } from '@/entities/application/application'
import { FitBreakdown } from '@/entities/application/job-fit'
import { m } from '@/shared/config/i18n'

const POLL_MS = 5000
const FAILED_COPY = {
  cv_text_unavailable: () => m.employer_workspace_app_fit_failed_cv(),
  cv_insufficient_content: () => m.employer_workspace_app_fit_failed_cv(),
  job_text_too_short: () => m.employer_workspace_app_fit_failed_job(),
}

function Message({ children }) {
  return <p className="text-xs leading-5 text-slate-500">{children}</p>
}

/**
 * Mức độ phù hợp do AI chấm trên bản CV đã nộp. Chỉ gắn khi danh sách báo hồ sơ có
 * `ai_match_status` (tính năng bật); đang phân tích thì tự hỏi lại mỗi 5 giây.
 */
export default function ApplicationFitSection({ application }) {
  const matchQuery = useQuery({
    queryKey: applicationKeys.recruiterMatch(application.public_id),
    queryFn: () => getRecruiterApplicationMatch(application.public_id),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? POLL_MS : false),
  })
  const match = matchQuery.data

  return (
    <section className="aw-section space-y-3" aria-labelledby="application-fit-title">
      <h3 id="application-fit-title" className="aw-section__title">{m.employer_workspace_app_fit_title()}</h3>
      {matchQuery.isLoading && <Skeleton active title={false} paragraph={{ rows: 4 }} />}
      {matchQuery.isError && (
        <Message>
          {m.employer_workspace_app_fit_load_failed()}{' '}
          <Button type="link" size="small" className="!p-0" onClick={() => matchQuery.refetch()}>
            {m.employer_workspace_app_fit_retry()}
          </Button>
        </Message>
      )}
      {match?.status === 'ready' && match.result && (
        <>
          <FitBreakdown result={match.result} />
          <Message>{m.employer_workspace_app_fit_disclaimer()}</Message>
        </>
      )}
      {match?.status === 'pending' && <Message>{m.employer_workspace_app_fit_pending()}</Message>}
      {match?.status === 'not_consented' && <Message>{m.employer_workspace_app_fit_not_consented()}</Message>}
      {match?.status === 'failed' && (
        <Message>
          {m.employer_workspace_app_fit_failed()} {FAILED_COPY[match.error_code]?.() || ''}
        </Message>
      )}
    </section>
  )
}
