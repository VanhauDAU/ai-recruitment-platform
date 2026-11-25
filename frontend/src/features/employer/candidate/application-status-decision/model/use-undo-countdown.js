import { useEffect, useState } from 'react'

/** Whole seconds left until `deadline`; 0 once it has passed or is missing. */
export function secondsUntil(deadline, now = Date.now()) {
  const at = deadline ? new Date(deadline).getTime() : Number.NaN
  return Number.isFinite(at) ? Math.max(0, Math.ceil((at - now) / 1000)) : 0
}

/**
 * Live countdown of the undo window. `onExpire` runs once when it reaches 0 so
 * the caller can refetch: the server has delivered the notice by then.
 */
export default function useUndoCountdown(deadline, onExpire) {
  const [seconds, setSeconds] = useState(() => secondsUntil(deadline))

  useEffect(() => {
    setSeconds(secondsUntil(deadline))
    if (!secondsUntil(deadline)) return undefined
    const timer = window.setInterval(() => {
      const left = secondsUntil(deadline)
      setSeconds(left)
      if (!left) {
        window.clearInterval(timer)
        onExpire?.()
      }
    }, 1000)
    return () => window.clearInterval(timer)
    // onExpire is a fire-once callback; restarting the timer for a new closure would skip it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline])

  return seconds
}
