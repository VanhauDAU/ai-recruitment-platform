import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { applicationKeys, getTalentPool, removeFromTalentPool } from '@/entities/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { formatDateTime } from '@/shared/lib/date-time'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/use-confirm-action'

export default function TalentPoolList() {
  const [q, setQ] = useState('')
  const queryClient = useQueryClient()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const query = useQuery({ queryKey: applicationKeys.talentPool({ q }), queryFn: () => getTalentPool({ q }) })
  const removeMutation = useMutation({
    mutationFn: (publicId) => removeFromTalentPool(publicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
      message.success('Đã bỏ khỏi kho.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể bỏ khỏi kho.')),
  })
  const entries = query.data?.results || []

  function remove(entry) {
    requestConfirmation({
      title: 'Bỏ khỏi kho tiềm năng',
      description: `${entry.candidate_name} sẽ không còn được gợi ý cho các tin mới.`,
      confirmText: 'Bỏ khỏi kho',
      danger: true,
      onConfirm: () => removeMutation.mutateAsync(entry.public_id),
    })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Input.Search allowClear aria-label="Tìm trong kho" placeholder="Tên, email, ghi chú hoặc tin đã nộp" onSearch={(value) => setQ(value.trim())} />
      <div className="mt-3">
        {query.isPending && <Skeleton active paragraph={{ rows: 5 }} />}
        {query.isError && <Alert showIcon type="error" title="Không tải được kho ứng viên" />}
        {!query.isPending && !query.isError && entries.length === 0 && <Empty description="Kho ứng viên tiềm năng đang trống" className="py-8" />}
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.public_id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{entry.candidate_name}</p>
                  <p className="truncate text-xs text-slate-500">{entry.candidate_email}</p>
                  {entry.source_application_public_id && (
                    <Link
                      to={`${employerAppPath('/applications')}?job=${entry.source_job_public_id}&application=${entry.source_application_public_id}`}
                      className="text-[11px] font-semibold text-emerald-600"
                    >
                      Hồ sơ đã nộp: {entry.source_job_title}
                    </Link>
                  )}
                </div>
                <Button size="small" onClick={() => remove(entry)}>Bỏ khỏi kho</Button>
              </div>
              {entry.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{entry.tags.map((tag) => <Tag key={tag} color="blue">{tag}</Tag>)}</div>}
              {entry.note && <p className="mt-2 text-xs text-slate-600">{entry.note}</p>}
              <p className="mt-1 text-[11px] text-slate-400">Lưu {formatDateTime(entry.created_at)} · Hết hạn {formatDateTime(entry.expires_at)}</p>
            </li>
          ))}
        </ul>
      </div>
      {confirmationModal}
    </section>
  )
}
