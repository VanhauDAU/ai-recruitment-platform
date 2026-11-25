import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { cancelInterview, completeInterview, storeThreadMessage } from '@/entities/messaging/conversation'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { formatDateTime } from '@/shared/lib/date-time'
import { message as toast } from '@/shared/lib/toast'
import { Button, Dialog } from '@/shared/ui/connect-kit'

const NOTE_MAX = 500

/**
 * Cancel (with an optional note for the candidate) or mark done the interview
 * on a card, as its `actions` allow. The cancel dialog carries a form field, so
 * it stays here instead of the shared yes/no confirmation.
 */
export default function InterviewCardActions({ conversation, message }) {
  const queryClient = useQueryClient()
  const noteId = useId()
  const [cancelling, setCancelling] = useState(false)
  const [note, setNote] = useState('')
  const interview = message.interview
  const actions = interview.actions || {}
  const mutation = useMutation({
    mutationFn: (action) => (action === 'cancel' ? cancelInterview(interview.public_id, note.trim()) : completeInterview(interview.public_id)),
    onSuccess: (updated) => {
      storeThreadMessage(queryClient, 'employer', conversation.public_id, updated)
      setCancelling(false)
      setNote('')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, m.connect_interview_update_failed())),
  })
  if (!actions.cancel && !actions.complete) return null

  return (
    <div className="pc-stub__actions">
      {actions.complete && (
        <Button variant="ink" loading={mutation.isPending && mutation.variables === 'complete'} onClick={() => mutation.mutate('complete')}>
          {m.connect_interview_complete()}
        </Button>
      )}
      {actions.cancel && <Button variant="danger" onClick={() => setCancelling(true)}>{m.connect_interview_cancel()}</Button>}
      <Dialog
        open={cancelling}
        title={m.connect_interview_cancel_title()}
        onClose={() => setCancelling(false)}
        footer={(
          <>
            <Button variant="ink" onClick={() => setCancelling(false)}>{m.connect_close()}</Button>
            <Button variant="danger" loading={mutation.isPending && mutation.variables === 'cancel'} onClick={() => mutation.mutate('cancel')}>
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
