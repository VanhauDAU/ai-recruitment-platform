import { useQuery } from '@tanstack/react-query'
import { Skeleton } from 'antd'
import { applicationKeys, getRecruiterApplicationCvProfile } from '@/entities/application/application'
import { ExtractedProfile } from '@/entities/application/job-fit'
import { m } from '@/shared/config/i18n'

const POLL_MS = 5000
const MESSAGES = {
  pending: () => m.employer_workspace_app_profile_pending(),
  not_consented: () => m.employer_workspace_app_profile_not_consented(),
  failed: () => m.employer_workspace_app_profile_failed(),
}

/** Hồ sơ trích xuất từ bản CV đã nộp, đặt cạnh CV gốc để đối chiếu. */
export default function ApplicationExtractedProfile({ publicId }) {
  const profileQuery = useQuery({
    queryKey: applicationKeys.recruiterCvProfile(publicId),
    queryFn: () => getRecruiterApplicationCvProfile(publicId),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? POLL_MS : false),
  })
  const data = profileQuery.data
  return (
    <div className="aw-profile">
      {profileQuery.isLoading && <Skeleton active paragraph={{ rows: 12 }} />}
      {profileQuery.isError && <p className="aw-profile__note">{m.employer_workspace_app_profile_load_failed()}</p>}
      {data?.status === 'ready' && (
        <>
          <p className="aw-profile__note">{m.employer_workspace_app_profile_hint()}</p>
          <ExtractedProfile profile={data.profile} />
        </>
      )}
      {data && data.status !== 'ready' && <p className="aw-profile__note">{MESSAGES[data.status]?.()}</p>}
    </div>
  )
}
