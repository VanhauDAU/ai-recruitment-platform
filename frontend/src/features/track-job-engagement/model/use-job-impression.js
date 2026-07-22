import { useEffect, useRef } from 'react'
import { useConsent } from '@/entities/consent'
import { enqueueJobImpression } from './impression-queue'

const VIEWABLE_RATIO = 0.5
const VIEWABLE_DURATION_MS = 1000

export function useJobImpression(slug) {
  const elementRef = useRef(null)
  const countedRef = useRef(false)
  const { consent, status } = useConsent()

  useEffect(() => {
    countedRef.current = false
  }, [slug])

  useEffect(() => {
    const element = elementRef.current
    if (
      !element
      || !slug
      || status !== 'ready'
      || !consent.analytics
      || typeof IntersectionObserver === 'undefined'
    ) return undefined

    let timer = null
    let viewable = false
    const cancelTimer = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
    const startTimer = () => {
      if (countedRef.current || timer || !viewable || document.visibilityState === 'hidden') return
      timer = setTimeout(() => {
        timer = null
        if (!viewable || document.visibilityState === 'hidden' || countedRef.current) return
        countedRef.current = true
        enqueueJobImpression(slug)
      }, VIEWABLE_DURATION_MS)
    }
    const observer = new IntersectionObserver(([entry]) => {
      viewable = entry.isIntersecting && entry.intersectionRatio >= VIEWABLE_RATIO
      if (viewable) startTimer()
      else cancelTimer()
    }, { threshold: [VIEWABLE_RATIO] })
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') cancelTimer()
      else startTimer()
    }

    observer.observe(element)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelTimer()
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [consent.analytics, slug, status])

  return elementRef
}
