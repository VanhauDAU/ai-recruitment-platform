import { SendOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Select, Skeleton, Tag } from 'antd'
import { applicationKeys, getTalentSuggestions, inviteFromTalentPool } from '@/entities/application/application'
import { getEmployerJobPage, jobKeys } from '@/entities/job/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { m } from '@/shared/config/i18n'

/** Re-match pool members to one open job and invite them to apply. */
export default function TalentSuggestions({ jobPublicId, onJobChange }) {
  const queryClient = useQueryClient()
  const jobParams = { status: 'active', page_size: 100 }
  const jobsQuery = useQuery({
    queryKey: jobKeys.employerList(jobParams),
    queryFn: () => getEmployerJobPage(jobParams),
  })
  const suggestionsQuery = useQuery({
    queryKey: applicationKeys.talentSuggestions(jobPublicId),
    queryFn: () => getTalentSuggestions(jobPublicId),
    enabled: Boolean(jobPublicId),
  })
  const inviteMutation = useMutation({
    mutationFn: ({ entryId }) => inviteFromTalentPool(entryId, jobPublicId),
    onSuccess: (_data, { name }) => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.talentSuggestions(jobPublicId) })
      message.success(m.employer_workspace_pool_invited_success({ name }))
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_workspace_pool_invite_error())),
  })
  const jobs = jobsQuery.data?.results || []

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">{m.employer_workspace_pool_suggestions_title()}</h2>
      <p className="mt-1 text-xs text-slate-500">{m.employer_workspace_pool_suggestions_description()}</p>
      <Select
        className="!mt-3 w-full"
        aria-label={m.employer_workspace_pool_select_job()}
        placeholder={m.employer_workspace_pool_select_job()}
        loading={jobsQuery.isPending}
        value={jobPublicId || undefined}
        options={jobs.map((job) => ({ value: job.public_id, label: job.title }))}
        onChange={onJobChange}
        showSearch
        optionFilterProp="label"
      />
      <div className="mt-3">
        {!jobPublicId && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_workspace_pool_select_job_hint()} />}
        {jobPublicId && suggestionsQuery.isPending && <Skeleton active paragraph={{ rows: 3 }} />}
        {suggestionsQuery.isError && <Alert showIcon type="error" title={m.employer_workspace_pool_suggestions_error()} />}
        {suggestionsQuery.data?.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_workspace_pool_suggestions_empty()} />}
        <ul className="space-y-2">
          {(suggestionsQuery.data || []).map(({ entry, score, reasons, already_invited: invited }) => (
            <li key={entry.public_id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{entry.candidate_name}</p>
                  <p className="truncate text-[11px] text-slate-500">{m.employer_workspace_pool_applied_before({ job: entry.source_job_title })}</p>
                </div>
                <Tag color="green">{m.employer_workspace_pool_score({ score })}</Tag>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">{reasons.map((reason) => <Tag key={reason}>{reason}</Tag>)}</div>
              <Button
                size="small"
                type={invited ? 'default' : 'primary'}
                icon={<SendOutlined />}
                disabled={invited}
                loading={inviteMutation.isPending && inviteMutation.variables?.entryId === entry.public_id}
                className="!mt-2"
                onClick={() => inviteMutation.mutate({ entryId: entry.public_id, name: entry.candidate_name })}
              >
                {invited ? m.employer_workspace_pool_invited() : m.employer_workspace_pool_invite()}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
