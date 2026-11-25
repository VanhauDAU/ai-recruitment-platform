import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { INTERVIEW_MODES, scheduleInterview, storeThreadMessage } from '@/entities/messaging/conversation'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message as toast } from '@/shared/lib/toast'
import { Button, Dialog } from '@/shared/ui/connect-kit'
import { DURATION_OPTIONS, interviewPayload, toLocalInputValue, validateInterview } from '../model/interview-form'

const ERROR_TEXT = {
  startsAt: { required: m.connect_interview_starts_at_required, future: m.connect_interview_starts_at_future },
  location: { required: m.connect_interview_location_required },
  meetingUrl: { invalid: m.connect_interview_meeting_url_invalid },
}

function Field({ id, label, error, children }) {
  return (
    <div className="pc-field">
      <label htmlFor={id} className="pc-field__label">{label}</label>
      {children}
      {error && <p id={`${id}-error`} className="pc-field__error">{error}</p>}
    </div>
  )
}

// Đổi giờ giữ nguyên hình thức, địa điểm, link và ghi chú của lịch cũ; chỉ chọn giờ mới.
function initialValues(previous) {
  if (!previous) return { startsAt: '', duration: '60', mode: 'onsite', location: '', meetingUrl: '', note: '' }
  return {
    startsAt: '',
    duration: String(previous.duration_minutes || 60),
    mode: previous.mode || 'onsite',
    location: previous.location || '',
    meetingUrl: previous.meeting_url || '',
    note: previous.note || '',
  }
}

/**
 * Propose an interview time; the card it creates replaces any earlier proposal.
 * `previous` (an interview card) turns it into "Đổi giờ": details prefilled, the
 * candidate's request shown, the old card superseded on send.
 */
export default function ScheduleInterviewModal({ conversation, previous = null, onClose }) {
  const queryClient = useQueryClient()
  const formId = useId()
  const [values, setValues] = useState(() => initialValues(previous))
  const [errors, setErrors] = useState({})
  const [minStart] = useState(() => toLocalInputValue(new Date()))
  const set = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }))
  const errorOf = (key) => (errors[key] ? ERROR_TEXT[key][errors[key]]() : '')
  const mutation = useMutation({
    mutationFn: () => scheduleInterview(conversation.public_id, interviewPayload(values)),
    onSuccess: (message) => {
      storeThreadMessage(queryClient, 'employer', conversation.public_id, message)
      toast.success(m.connect_interview_scheduled())
      onClose()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, m.connect_interview_schedule_failed())),
  })

  const submit = (event) => {
    event.preventDefault()
    const next = validateInterview(values)
    setErrors(next)
    if (!Object.keys(next).length) mutation.mutate()
  }

  return (
    <Dialog
      open
      title={previous ? m.connect_interview_reschedule_title() : m.connect_interview_schedule_title()}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ink" onClick={onClose}>{m.connect_cancel()}</Button>
          <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>{m.connect_interview_schedule_submit()}</Button>
        </>
      )}
    >
      <p className="pc-dialog__hint">
        {m.connect_interview_schedule_for({ name: conversation.counterpart?.name || '', job: conversation.job?.title || '' })}
      </p>
      {previous?.candidate_note && (
        <p className="pc-dialog__hint">{m.connect_interview_candidate_note({ note: previous.candidate_note })}</p>
      )}
      <form id={formId} noValidate onSubmit={submit} className="pc-form">
        <Field id={`${formId}-start`} label={m.connect_interview_starts_at()} error={errorOf('startsAt')}>
          <input
            id={`${formId}-start`}
            type="datetime-local"
            value={values.startsAt}
            min={minStart}
            onChange={set('startsAt')}
            aria-invalid={Boolean(errors.startsAt)}
            aria-describedby={errors.startsAt ? `${formId}-start-error` : undefined}
            className="pc-input"
          />
        </Field>
        <Field id={`${formId}-duration`} label={m.connect_interview_duration_label()}>
          <select id={`${formId}-duration`} value={values.duration} onChange={set('duration')} className="pc-input">
            {DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{m.connect_interview_duration({ minutes })}</option>)}
          </select>
        </Field>
        <fieldset className="pc-field">
          <legend className="pc-field__label">{m.connect_interview_mode_label()}</legend>
          <div className="pc-segmented">
            {INTERVIEW_MODES.map(([mode, label]) => (
              <label key={mode} className="pc-segmented__option">
                <input type="radio" name={`${formId}-mode`} value={mode} checked={values.mode === mode} onChange={set('mode')} />
                <span>{label()}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {values.mode === 'onsite' && (
          <Field id={`${formId}-location`} label={m.connect_interview_location()} error={errorOf('location')}>
            <input id={`${formId}-location`} value={values.location} maxLength={255} onChange={set('location')} aria-invalid={Boolean(errors.location)} className="pc-input" />
          </Field>
        )}
        {values.mode === 'online' && (
          <Field id={`${formId}-url`} label={m.connect_interview_meeting_url()} error={errorOf('meetingUrl')}>
            <input
              id={`${formId}-url`}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={values.meetingUrl}
              maxLength={500}
              onChange={set('meetingUrl')}
              aria-invalid={Boolean(errors.meetingUrl)}
              className="pc-input"
            />
          </Field>
        )}
        <Field id={`${formId}-note`} label={m.connect_interview_note()}>
          <textarea
            id={`${formId}-note`}
            value={values.note}
            maxLength={1000}
            rows={3}
            onChange={set('note')}
            placeholder={m.connect_interview_note_hint()}
            className="pc-input pc-input--area"
          />
        </Field>
      </form>
    </Dialog>
  )
}
