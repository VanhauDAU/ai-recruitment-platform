import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { respondToInterview, storeThreadMessage } from '@/entities/messaging/conversation'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message as toast } from '@/shared/lib/toast'
import { Button, Dialog } from '@/shared/ui/connect-kit'

const NOTE_MAX = 500

/** Candidate answer on a proposed interview: accept, ask for another time or decline. */
export default function InterviewResponse({ conversation, message }) {
  const queryClient = useQueryClient()
  const noteId = useId()
  const [asking, setAsking] = useState(null)
  const [note, setNote] = useState('')
  const interview = message.interview
  const mutation = useMutation({
    mutationFn: (payload) => respondToInterview(interview.public_id, payload),
    onSuccess: (updated) => {
      storeThreadMessage(queryClient, 'candidate', conversation.public_id, updated)
      setAsking(null)
      setNote('')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, m.connect_interview_respond_failed())),
  })
  if (!interview.actions?.respond) return null

  const reschedule = asking === 'reschedule'
  return (
    <div className="pc-stub__actions">
      <Button variant="accent" loading={mutation.isPending && mutation.variables?.action === 'accept'} onClick={() => mutation.mutate({ action: 'accept' })}>
        {m.connect_interview_accept()}
      </Button>
      <Button variant="ink" onClick={() => setAsking('reschedule')}>{m.connect_interview_reschedule()}</Button>
      <Button variant="danger" onClick={() => setAsking('decline')}>{m.connect_interview_decline()}</Button>
      <Dialog
        open={Boolean(asking)}
        title={reschedule ? m.connect_interview_reschedule_title() : m.connect_interview_decline_title()}
        onClose={() => setAsking(null)}
        footer={(
          <>
            <Button variant="ink" onClick={() => setAsking(null)}>{m.connect_cancel()}</Button>
            <Button
              variant={reschedule ? 'primary' : 'danger'}
              disabled={reschedule && !note.trim()}
              loading={mutation.isPending}
              onClick={() => mutation.mutate({ action: asking, note: note.trim() })}
            >
              {reschedule ? m.connect_interview_reschedule_submit() : m.connect_interview_decline()}
            </Button>
          </>
        )}
      >
        <p className="pc-dialog__hint">{reschedule ? m.connect_interview_reschedule_hint() : m.connect_interview_decline_hint()}</p>
        <label className="pc-field" htmlFor={noteId}>
          <span className="pc-field__label">{m.connect_interview_note_label()}</span>
          <textarea
            id={noteId}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={NOTE_MAX}
            rows={3}
            placeholder={reschedule ? m.connect_interview_reschedule_placeholder() : m.connect_interview_note_placeholder()}
            className="pc-input pc-input--area"
          />
        </label>
      </Dialog>
    </div>
  )
}
