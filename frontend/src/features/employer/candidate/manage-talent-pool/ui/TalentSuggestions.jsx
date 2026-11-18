import { SendOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Select, Skeleton, Tag } from 'antd'
import { applicationKeys, getTalentSuggestions, inviteFromTalentPool } from '@/entities/application/application'
import { getEmployerJobPage, jobKeys } from '@/entities/job/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

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
      message.success(`Đã mời ${name} ứng tuyển.`)
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể gửi lời mời.')),
  })
  const jobs = jobsQuery.data?.results || []

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">Gợi ý cho tin đang tuyển</h2>
      <p className="mt-1 text-xs text-slate-500">Xếp theo độ tương đồng giữa tin ứng viên từng nộp và tin bạn chọn.</p>
      <Select
        className="!mt-3 w-full"
        aria-label="Chọn tin tuyển dụng"
        placeholder="Chọn tin tuyển dụng"
        loading={jobsQuery.isPending}
        value={jobPublicId || undefined}
        options={jobs.map((job) => ({ value: job.public_id, label: job.title }))}
        onChange={onJobChange}
        showSearch
        optionFilterProp="label"
      />
      <div className="mt-3">
        {!jobPublicId && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chọn một tin để xem gợi ý" />}
        {jobPublicId && suggestionsQuery.isPending && <Skeleton active paragraph={{ rows: 3 }} />}
        {suggestionsQuery.isError && <Alert showIcon type="error" title="Không tải được gợi ý" />}
        {suggestionsQuery.data?.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có ai trong kho phù hợp với tin này" />}
        <ul className="space-y-2">
          {(suggestionsQuery.data || []).map(({ entry, score, reasons, already_invited: invited }) => (
            <li key={entry.public_id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{entry.candidate_name}</p>
                  <p className="truncate text-[11px] text-slate-500">Từng ứng tuyển: {entry.source_job_title}</p>
                </div>
                <Tag color="green">{score} điểm</Tag>
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
                {invited ? 'Đã mời' : 'Mời ứng tuyển'}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
