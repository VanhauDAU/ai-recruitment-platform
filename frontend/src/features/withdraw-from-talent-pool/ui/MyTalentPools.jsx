import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Skeleton } from 'antd'
import { applicationKeys, getMyTalentPools, withdrawFromTalentPool } from '@/entities/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { formatDateTime } from '@/shared/lib/date-time'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/use-confirm-action'

/** Which employers keep the candidate's profile, and the right to leave. */
export default function MyTalentPools() {
  const queryClient = useQueryClient()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const query = useQuery({ queryKey: applicationKeys.myTalentPools, queryFn: getMyTalentPools })
  const mutation = useMutation({
    mutationFn: (publicId) => withdrawFromTalentPool(publicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.myTalentPools })
      message.success('Đã rút hồ sơ khỏi kho của nhà tuyển dụng.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể rút hồ sơ.')),
  })
  const entries = query.data || []

  function withdraw(entry) {
    requestConfirmation({
      title: 'Rút hồ sơ khỏi kho',
      description: `${entry.company_name} sẽ không còn lưu hồ sơ của bạn để gợi ý cho vị trí mới.`,
      confirmText: 'Rút hồ sơ',
      danger: true,
      onConfirm: () => mutation.mutateAsync(entry.public_id),
    })
  }

  if (query.isPending) return <Skeleton active paragraph={{ rows: 4 }} className="p-5" />
  if (query.isError) return <Alert showIcon type="error" className="!m-5" title="Không tải được danh sách" />
  if (!entries.length) {
    return <Empty className="py-10" description="Chưa nhà tuyển dụng nào lưu hồ sơ của bạn vào kho ứng viên tiềm năng" />
  }
  return (
    <ul className="space-y-2 p-5">
      {entries.map((entry) => (
        <li key={entry.public_id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">{entry.company_name}</p>
            <p className="truncate text-xs text-slate-500">Từ hồ sơ ứng tuyển: {entry.source_job_title}</p>
            <p className="mt-1 text-[11px] text-slate-400">Lưu {formatDateTime(entry.created_at)} · Tự xóa {formatDateTime(entry.expires_at)}</p>
          </div>
          <Button danger onClick={() => withdraw(entry)}>Rút hồ sơ</Button>
        </li>
      ))}
      {confirmationModal}
    </ul>
  )
}
