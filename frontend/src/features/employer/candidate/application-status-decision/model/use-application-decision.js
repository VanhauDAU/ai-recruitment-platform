import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  applicationKeys,
  decideApplicationStatus,
  RECRUITER_APPLICATION_STATUS_LABELS,
  replaceApplicationInPage,
  TERMINAL_APPLICATION_STATUSES,
  undoApplicationStatusChange,
} from '@/entities/application/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { formatClockTime } from '@/shared/lib/date-time'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'

const TERMINAL_COPY = {
  accepted: { title: 'Xác nhận trúng tuyển', confirmText: 'Trúng tuyển', danger: false },
  rejected: { title: 'Xác nhận không phù hợp', confirmText: 'Không phù hợp', danger: true },
}

/**
 * Recruiter decisions on one application. The server delays the candidate
 * notice, so every decision toast offers "Hoàn tác" until it is delivered.
 */
export default function useApplicationDecision(application, candidateName) {
  const queryClient = useQueryClient()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const publicId = application?.public_id

  function sync(updated) {
    queryClient.setQueriesData(
      { queryKey: applicationKeys.recruiterLists() },
      (page) => replaceApplicationInPage(page, updated),
    )
    queryClient.invalidateQueries({ queryKey: applicationKeys.history(updated.public_id) })
    queryClient.invalidateQueries({ queryKey: applicationKeys.recruiterUnreadCount() })
  }

  const undoMutation = useMutation({
    mutationFn: (publicId) => undoApplicationStatusChange(publicId),
    onSuccess: (updated) => {
      sync(updated)
      message.success('Đã hoàn tác. Ứng viên sẽ không nhận thông báo này.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể hoàn tác thay đổi này.')),
  })

  const decideMutation = useMutation({
    mutationFn: (status) => decideApplicationStatus(publicId, status),
    onSuccess: ({ application: updated, candidate_notice_at: noticeAt }) => {
      sync(updated)
      message.success(`Đã chuyển hồ sơ sang “${RECRUITER_APPLICATION_STATUS_LABELS[updated.status]}”`, {
        description: `Ứng viên sẽ nhận thông báo lúc ${formatClockTime(noticeAt)}.`,
        action: { label: 'Hoàn tác', onClick: () => undoMutation.mutate(updated.public_id) },
        duration: 10_000,
      })
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể cập nhật trạng thái hồ sơ.')),
  })

  function decide(status) {
    if (!publicId || decideMutation.isPending || status === application.status) return
    if (!TERMINAL_APPLICATION_STATUSES.includes(status)) {
      decideMutation.mutate(status)
      return
    }
    requestConfirmation({
      ...TERMINAL_COPY[status],
      description: `Hồ sơ của ${candidateName} sẽ chuyển sang “${RECRUITER_APPLICATION_STATUS_LABELS[status]}” và không thể đổi tiếp. `
        + 'Ứng viên chỉ được thông báo sau ít phút; trong thời gian đó bạn vẫn có thể hoàn tác.',
      onConfirm: () => decideMutation.mutateAsync(status),
    })
  }

  return {
    confirmationModal,
    decide,
    deciding: decideMutation.isPending,
    undo: () => publicId && undoMutation.mutate(publicId),
    undoing: undoMutation.isPending,
  }
}
