import { useEffect, useRef, useSyncExternalStore } from 'react'
import { getRealtimeStatus, subscribeRealtime, subscribeRealtimeStatus } from './realtime-socket'

/** `true` while the notification socket is open; polling may then stop. */
export function useRealtimeOpen() {
  return useSyncExternalStore(subscribeRealtimeStatus, getRealtimeStatus, () => 'idle') === 'open'
}

/** Run `handler` for every realtime event while mounted (latest closure wins). */
export function useRealtimeEvents(handler, { enabled = true } = {}) {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    if (!enabled) return undefined
    return subscribeRealtime((event) => latest.current(event))
  }, [enabled])
}
