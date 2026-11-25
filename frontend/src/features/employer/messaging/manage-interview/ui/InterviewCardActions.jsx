import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { applicationKeys, decideApplicationStatus } from '@/entities/application/application'
import { cancelInterview, conversationKeys, storeThreadMessage } from '@/entities/messaging/conversation'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { formatDateTime } from '@/shared/lib/date-time'
import { message as toast } from '@/shared/lib/toast'
import { Button, Dialog } from '@/shared/ui/connect-kit'

const NOTE_MAX = 500

/**
 * Reschedule (form prefilled from this card), cancel (with an optional note for the
 * candidate), or — once the
 * accepted interview is over — record the result of the application right on the
 * card (Trúng tuyển / Không phù hợp, the normal decision with its undo window).
 */
export default function InterviewCardActions({ conversation, message, onReschedule }) {
  const queryClient = useQueryClient()
  const noteId = useId()
  const [cancelling, setCancelling] = useState(false)
  const [deciding, setDeciding] = useState(null)
  const [note, setNote] = useState('')
  const interview = message.interview
  const actions = interview.actions || {}
  const mutation = useMutation({
    mutationFn: () => cancelInterview(interview.public_id, note.trim()),
    onSuccess: (updated) => {
      storeThreadMessage(queryClient, 'employer', conversation.public_id, updated)
      setCancelling(false)
      setNote('')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, m.connect_interview_update_failed())),
  })
  const decision = useMutation({
    mutationFn: (status) => decideApplicationStatus(interview.application_public_id, status),
    onSuccess: (_data, status) => {
      setDeciding(null)
      toast.success(status === 'accepted' ? m.connect_interview_decided_accepted() : m.connect_interview_decided_rejected())
      queryClient.invalidateQueries({ queryKey: conversationKeys.messages('employer', conversation.public_id) })
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail('employer', conversation.public_id) })
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, m.connect_interview_update_failed())),
  })
  if (!actions.cancel && !actions.decide && !actions.reschedule) return null

  return (
    <div className="pc-stub__actions">
      {actions.decide && (
        <>
          <Button variant="accent" onClick={() => setDeciding('accepted')}>{m.connect_interview_decide_accept()}</Button>
          <Button variant="danger" onClick={() => setDeciding('rejected')}>{m.connect_interview_decide_reject()}</Button>
        </>
      )}
      {actions.reschedule && onReschedule && (
        <Button variant={interview.status === 'reschedule_requested' ? 'accent' : 'ink'} onClick={() => onReschedule(interview)}>
          {m.connect_interview_reschedule()}
        </Button>
      )}
      {actions.cancel && <Button variant="danger" onClick={() => setCancelling(true)}>{m.connect_interview_cancel()}</Button>}
      <Dialog
        open={Boolean(deciding)}
        title={deciding === 'accepted' ? m.connect_interview_decide_accept_title() : m.connect_interview_decide_reject_title()}
        onClose={() => setDeciding(null)}
        footer={(
          <>
            <Button variant="ink" onClick={() => setDeciding(null)}>{m.connect_close()}</Button>
            <Button variant="primary" loading={decision.isPending} onClick={() => decision.mutate(deciding)}>
              {deciding === 'accepted' ? m.connect_interview_decide_accept() : m.connect_interview_decide_reject()}
            </Button>
          </>
        )}
      >
        <p className="pc-dialog__hint">{m.connect_interview_decide_text({ name: conversation.counterpart?.name || '' })}</p>
      </Dialog>
      <Dialog
        open={cancelling}
        title={m.connect_interview_cancel_title()}
        onClose={() => setCancelling(false)}
        footer={(
          <>
            <Button variant="ink" onClick={() => setCancelling(false)}>{m.connect_close()}</Button>
            <Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              {m.connect_interview_cancel()}
            </Button>
          </>
        )}
      >
        <p className="pc-dialog__hint">
          {m.connect_interview_cancel_text({ name: conversation.counterpart?.name || '', time: formatDateTime(interview.starts_at) })}
        </p>
        <label className="pc-field" htmlFor={noteId}>
          <span className="pc-field__label">{m.connect_interview_note_label()}</span>
          <textarea id={noteId} value={note} onChange={(event) => setNote(event.target.value)} maxLength={NOTE_MAX} rows={3} className="pc-input pc-input--area" />
        </label>
      </Dialog>
    </div>
  )
}
