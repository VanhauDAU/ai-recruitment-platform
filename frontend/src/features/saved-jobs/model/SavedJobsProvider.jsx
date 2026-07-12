import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSavedJobs, saveJob, unsaveJob } from '@/features/save-job'
import { useAuth } from '@/features/auth'
import SavedJobsContext from './savedJobsContext'

const CHANNEL_NAME = 'procv:saved-jobs'
const EVENT_NAME = 'procv:saved-jobs:changed'

function notifyOtherTabs(candidateKey) {
  if (typeof window === 'undefined') return

  const detail = { candidateKey, at: Date.now() }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }))

  if (typeof BroadcastChannel !== 'function') return
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.postMessage(detail)
  channel.close()
}

/**
 * Server state for one candidate's saved jobs.
 *
 * The API remains the source of truth. Optimistic mutations keep the current
 * tab responsive; a BroadcastChannel refresh and focus refresh reconcile other
 * tabs after save/unsave, login, or returning to the tab.
 */
export default function SavedJobsProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const isCandidate = isAuthenticated && user?.role === 'candidate'
  const candidateKey = isCandidate ? (user?.public_id || user?.id) : null
  const requestId = useRef(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(null)
  const [pending, setPending] = useState(() => new Set())

  const reload = useCallback(async () => {
    if (!candidateKey) {
      setItems([])
      setPending(new Set())
      setError(null)
      setLoading(false)
      return
    }

    const currentRequest = ++requestId.current
    setLoading(true)
    try {
      const data = await getSavedJobs()
      if (currentRequest === requestId.current) {
        setItems(Array.isArray(data) ? data : [])
        setError(null)
      }
    } catch (nextError) {
      if (currentRequest === requestId.current) {
        setItems([])
        setError(nextError)
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [candidateKey])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!candidateKey || typeof window === 'undefined') return undefined

    const refreshForCandidate = (detail) => {
      if (!detail?.candidateKey || detail.candidateKey === candidateKey) reload()
    }
    const onLocalChange = (event) => refreshForCandidate(event.detail)
    const onFocus = () => reload()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reload()
    }
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null

    channel?.addEventListener('message', (event) => refreshForCandidate(event.data))
    window.addEventListener(EVENT_NAME, onLocalChange)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      channel?.close()
      window.removeEventListener(EVENT_NAME, onLocalChange)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [candidateKey, reload])

  const savedIds = useMemo(
    () => new Set([...items.map((item) => item.job_detail?.public_id).filter(Boolean), ...pending]),
    [items, pending],
  )

  const toggle = useCallback(async (publicId) => {
    if (!candidateKey || !publicId) return

    if (savedIds.has(publicId)) {
      const snapshot = items
      setItems((previous) => previous.filter((item) => item.job_detail?.public_id !== publicId))
      try {
        await unsaveJob(publicId)
        notifyOtherTabs(candidateKey)
      } catch (nextError) {
        setItems(snapshot)
        setError(nextError)
      }
      return
    }

    setPending((previous) => new Set(previous).add(publicId))
    try {
      const created = await saveJob(publicId)
      setItems((previous) => [created, ...previous.filter((item) => item.job_detail?.public_id !== publicId)])
      setSaveSuccess({ publicId, at: Date.now() })
      setError(null)
      notifyOtherTabs(candidateKey)
    } catch (nextError) {
      setError(nextError)
    } finally {
      setPending((previous) => {
        const next = new Set(previous)
        next.delete(publicId)
        return next
      })
    }
  }, [candidateKey, savedIds, items])

  const value = useMemo(
    () => ({ items, savedIds, loading, error, reload, toggle, isCandidate, saveSuccess }),
    [items, savedIds, loading, error, reload, toggle, isCandidate, saveSuccess],
  )

  return <SavedJobsContext.Provider value={value}>{children}</SavedJobsContext.Provider>
}
