export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]

const pad = (number) => String(number).padStart(2, '0')

/** `YYYY-MM-DDTHH:mm` in local time, the value format of `<input type="datetime-local">`. */
export function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Field errors (keys of the form) for an interview proposal, checked in the
 * browser before the API checks again. `now` is injectable for tests.
 */
export function validateInterview(values, now = new Date()) {
  const errors = {}
  const startsAt = values.startsAt ? new Date(values.startsAt) : null
  if (!startsAt || Number.isNaN(startsAt.getTime())) errors.startsAt = 'required'
  else if (startsAt <= now) errors.startsAt = 'future'
  if (values.mode === 'onsite' && !values.location.trim()) errors.location = 'required'
  if (values.mode === 'online' && !/^https?:\/\/\S+$/i.test(values.meetingUrl.trim())) errors.meetingUrl = 'invalid'
  return errors
}

/** Request body of `POST /employer/conversations/{id}/interviews/`. */
export function interviewPayload(values) {
  return {
    starts_at: new Date(values.startsAt).toISOString(),
    duration_minutes: Number(values.duration),
    mode: values.mode,
    location: values.mode === 'onsite' ? values.location.trim() : '',
    meeting_url: values.mode === 'online' ? values.meetingUrl.trim() : '',
    note: values.note.trim(),
  }
}
