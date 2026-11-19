import './next-action-label.css'

/** Tone dot + label for a `recruiterNextAction(...)` result. */
export default function NextActionLabel({ action, prefix = '' }) {
  if (!action) return null
  return (
    <span className={`next-action-label next-action-label--${action.tone}`}>
      <i aria-hidden="true" />
      {`${prefix}${action.label}`}
    </span>
  )
}
