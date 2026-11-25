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
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import { m } from '@/shared/config/i18n'
import { secondsUntil } from './use-undo-countdown'

const TERMINAL_COPY = {
  accepted: { title: m.employer_workspace_decision_confirm_accept_title(), confirmText: m.employer_workspace_decision_accepted(), danger: false },
  rejected: { title: m.employer_workspace_decision_confirm_reject_title(), confirmText: m.employer_workspace_decision_rejected(), danger: true },
}

/**
 * Recruiter decisions on one application. The server delays the candidate
 * notice by a short undo window (15 s by default), so the decision toast
 * offers "Hoàn tác" for exactly that long.
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
      message.success(m.employer_workspace_decision_undone())
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_workspace_decision_undo_error())),
  })

  const decideMutation = useMutation({
    mutationFn: (status) => decideApplicationStatus(publicId, status),
    onSuccess: ({ application: updated, candidate_notice_at: noticeAt }) => {
      sync(updated)
      const seconds = secondsUntil(noticeAt)
      const title = m.employer_workspace_decision_moved({ status: RECRUITER_APPLICATION_STATUS_LABELS[updated.status] })
      if (!seconds) {
        message.success(title)
        return
      }
      message.success(title, {
        description: m.employer_workspace_decision_moved_description({ seconds }),
        action: { label: m.employer_workspace_decision_undo(), onClick: () => undoMutation.mutate(updated.public_id) },
        duration: seconds * 1000,
      })
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_workspace_decision_update_error())),
  })

  function decide(status) {
    if (!publicId || decideMutation.isPending || status === application.status) return
    if (!TERMINAL_APPLICATION_STATUSES.includes(status)) {
      decideMutation.mutate(status)
      return
    }
    requestConfirmation({
      ...TERMINAL_COPY[status],
      description: m.employer_workspace_decision_confirm_description({ name: candidateName, status: RECRUITER_APPLICATION_STATUS_LABELS[status] }),
      onConfirm: () => decideMutation.mutateAsync(status),
    })
  }

  return {
    confirmationModal,
    refreshHistory: () => publicId && queryClient.invalidateQueries({ queryKey: applicationKeys.history(publicId) }),
    decide,
    deciding: decideMutation.isPending,
    undo: () => publicId && undoMutation.mutate(publicId),
    undoing: undoMutation.isPending,
  }
}
