import { SendOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Drawer, Grid, Skeleton } from 'antd'
import { ExtractedProfile, FitBreakdown } from '@/entities/application/job-fit'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { candidateSearchKeys, getCandidateSearchDetail, inviteSearchCandidate } from '../api/candidate-search.api'

/** Xem nhanh một ứng viên: hồ sơ trích xuất ẩn danh, mức phù hợp với tin, mời ứng tuyển. */
export default function CandidateQuickView({ candidate, jobPublicId, onClose }) {
  const queryClient = useQueryClient()
  const wide = Grid.useBreakpoint().md
  const detailQuery = useQuery({
    queryKey: candidateSearchKeys.detail(candidate.ref, jobPublicId),
    queryFn: () => getCandidateSearchDetail(candidate.ref, jobPublicId),
    // Mỗi lần gọi được ghi nhật ký truy cập: không tự gọi lại ở nền.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const inviteMutation = useMutation({
    mutationFn: () => inviteSearchCandidate(candidate.ref, jobPublicId),
    onSuccess: () => {
      queryClient.setQueryData(candidateSearchKeys.detail(candidate.ref, jobPublicId), (current) => (
        current ? { ...current, invited: true } : current
      ))
      queryClient.invalidateQueries({ queryKey: candidateSearchKeys.all(), refetchType: 'active' })
      message.success(m.employer_workspace_search_invite_success({ code: candidate.code }))
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_workspace_search_invite_failed())),
  })
  const detail = detailQuery.data
  const state = detail || candidate

  return (
    <Drawer
      open
      onClose={onClose}
      placement={wide ? 'right' : 'bottom'}
      size={wide ? 560 : '92%'}
      title={m.employer_workspace_search_quick_view_title({ code: candidate.code })}
      footer={(
        <div className="cs-drawer-footer">
          <p>{m.employer_workspace_search_privacy_note()}</p>
          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={state.applied || state.invited}
            loading={inviteMutation.isPending}
            onClick={() => inviteMutation.mutate()}
          >
            {state.applied
              ? m.employer_workspace_search_applied()
              : state.invited
                ? m.employer_workspace_search_invited()
                : m.employer_workspace_search_invite()}
          </Button>
        </div>
      )}
    >
      {detailQuery.isLoading && <Skeleton active paragraph={{ rows: 10 }} />}
      {detailQuery.isError && (
        <p className="cs-muted">{getApiErrorMessage(detailQuery.error, m.employer_workspace_search_load_failed())}</p>
      )}
      {detail && (
        <div className="cs-quick">
          <section aria-labelledby="cs-profile-title">
            <h3 id="cs-profile-title" className="cs-heading">{m.employer_workspace_search_profile_heading()}</h3>
            <ExtractedProfile profile={detail.profile} />
          </section>
          <section aria-labelledby="cs-fit-title">
            <h3 id="cs-fit-title" className="cs-heading">{m.employer_workspace_search_fit_heading()}</h3>
            <FitBreakdown result={detail.result} showEvidence={false} />
          </section>
        </div>
      )}
    </Drawer>
  )
}
