import { useEffect, useRef } from 'react'
import { useConsent } from '@/entities/consent'
import { recordJobView } from '@/entities/job'

const VIEW_DURATION_MS = 1000

export function useJobView(slug, { enabled = true, onTracked } = {}) {
  const { consent, status } = useConsent()
  const trackedRef = useRef(false)
  const onTrackedRef = useRef(onTracked)
  onTrackedRef.current = onTracked

  useEffect(() => {
    trackedRef.current = false
  }, [slug])

  useEffect(() => {
    if (!enabled || !slug || status !== 'ready' || !consent.analytics) return undefined
    let timer = null
    let cancelled = false
    const cancelTimer = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
    const startTimer = () => {
      if (timer || trackedRef.current || document.visibilityState === 'hidden') return
      timer = setTimeout(() => {
        timer = null
        if (cancelled || document.visibilityState === 'hidden' || trackedRef.current) return
        trackedRef.current = true
        recordJobView(slug)
          .then((result) => {
            if (!cancelled) onTrackedRef.current?.(result)
          })
          .catch(() => {})
      }, VIEW_DURATION_MS)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') cancelTimer()
      else startTimer()
    }

    startTimer()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelled = true
      cancelTimer()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [consent.analytics, enabled, slug, status])
}
