import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Pagination, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { applicationKeys, getCandidateBlocks, liftCandidateBlock } from '@/entities/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { formatDateTime } from '@/shared/lib/date-time'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/use-confirm-action'

export default function CandidateBlockList() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const query = useQuery({ queryKey: applicationKeys.candidateBlocks(page), queryFn: () => getCandidateBlocks(page) })
  const liftMutation = useMutation({
    mutationFn: (publicId) => liftCandidateBlock(publicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
      message.success('Đã gỡ chặn. Ứng viên có thể ứng tuyển lại.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể gỡ chặn.')),
  })
  const blocks = query.data?.results || []

  function lift(block) {
    requestConfirmation({
      title: 'Gỡ chặn ứng viên',
      description: `${block.candidate_name} sẽ có thể nộp hồ sơ vào các tin của công ty trở lại.`,
      confirmText: 'Gỡ chặn',
      onConfirm: () => liftMutation.mutateAsync(block.public_id),
    })
  }

  if (query.isPending) return <Skeleton active paragraph={{ rows: 6 }} />
  if (query.isError) {
    return <Alert showIcon type="error" title="Không tải được danh sách đen" description={getApiErrorMessage(query.error, 'Vui lòng thử lại.')} />
  }
  if (!blocks.length) return <Empty description="Công ty chưa chặn ứng viên nào" className="py-10" />

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
                {block.source_job_title && <span className="text-[11px] text-slate-500">Từ hồ sơ: {block.source_job_title}</span>}
              </div>
              {block.note && <p className="mt-1 text-xs text-slate-600">{block.note}</p>}
              <p className="mt-1 text-[11px] text-slate-400">
                {block.blocked_by_name} chặn lúc {formatDateTime(block.created_at)} · {block.expires_at ? `Hết hạn ${formatDateTime(block.expires_at)}` : 'Không thời hạn'}
              </p>
            </div>
            {block.can_lift && <Button onClick={() => lift(block)}>Gỡ chặn</Button>}
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
