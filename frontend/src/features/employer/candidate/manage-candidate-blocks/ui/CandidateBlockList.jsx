import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Pagination, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { applicationKeys, getCandidateBlocks, liftCandidateBlock } from '@/entities/application/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { formatDateTime } from '@/shared/lib/date-time'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import { m } from '@/shared/config/i18n'

export default function CandidateBlockList() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const query = useQuery({ queryKey: applicationKeys.candidateBlocks(page), queryFn: () => getCandidateBlocks(page) })
  const liftMutation = useMutation({
    mutationFn: (publicId) => liftCandidateBlock(publicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
      message.success(m.employer_workspace_blocklist_lifted())
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_workspace_blocklist_lift_error())),
  })
  const blocks = query.data?.results || []

  function lift(block) {
    requestConfirmation({
      title: m.employer_workspace_blocklist_lift_title(),
      description: m.employer_workspace_blocklist_lift_description({ name: block.candidate_name }),
      confirmText: m.employer_workspace_blocklist_lift(),
      onConfirm: () => liftMutation.mutateAsync(block.public_id),
    })
  }

  if (query.isPending) return <Skeleton active paragraph={{ rows: 6 }} />
  if (query.isError) {
    return <Alert showIcon type="error" title={m.employer_workspace_blocklist_load_error()} description={getApiErrorMessage(query.error, m.employer_workspace_try_again())} />
  }
  if (!blocks.length) return <Empty description={m.employer_workspace_blocklist_empty()} className="py-10" />

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {blocks.map((block) => (
          <li key={block.public_id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">{block.candidate_name}</p>
              <p className="truncate text-xs text-slate-500">{block.candidate_email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Tag color="red">{block.reason_label}</Tag>
                {block.source_job_title && <span className="text-[11px] text-slate-500">{m.employer_workspace_blocklist_from_application({ job: block.source_job_title })}</span>}
              </div>
              {block.note && <p className="mt-1 text-xs text-slate-600">{block.note}</p>}
              <p className="mt-1 text-[11px] text-slate-400">
                {m.employer_workspace_blocklist_blocked_by({ name: block.blocked_by_name, date: formatDateTime(block.created_at) })} · {block.expires_at ? m.employer_workspace_expires_on({ date: formatDateTime(block.expires_at) }) : m.employer_workspace_blocklist_no_expiry()}
              </p>
            </div>
            {block.can_lift && <Button onClick={() => lift(block)}>{m.employer_workspace_blocklist_lift()}</Button>}
          </li>
        ))}
      </ul>
      {query.data.count > blocks.length && (
        <Pagination simple current={page} total={query.data.count} pageSize={20} onChange={setPage} />
      )}
      {confirmationModal}
    </div>
  )
}
