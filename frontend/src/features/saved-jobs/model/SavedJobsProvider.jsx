import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSession } from '@/entities/session'
import SavedJobsContext from './saved-jobs-context'
import { publishSavedJobsChanged, subscribeSavedJobsSync } from './saved-jobs-sync'
import useSavedJobsQuery from './use-saved-jobs-query'
import useToggleSavedJob from './use-toggle-saved-job'

export default function SavedJobsProvider({ children }) {
  const { user, isAuthenticated } = useSession()
  const isCandidate = isAuthenticated && user?.role === 'candidate'
  const candidateKey = isCandidate ? (user?.public_id || user?.id) : null
  const syncSourceId = useRef(`saved-jobs-${Math.random().toString(36).slice(2)}`)
  const { items, setItems, loading, error, setError, reload } = useSavedJobsQuery(candidateKey)
  const publish = useCallback(
    () => publishSavedJobsChanged({ candidateKey, sourceId: syncSourceId.current }),
    [candidateKey],
  )
  const { pendingJobIds, saveSuccess, toggle } = useToggleSavedJob({ candidateKey, items, setError, setItems, publish })
  const savedIds = useMemo(() => new Set(items.map((item) => item.job_detail?.public_id).filter(Boolean)), [items])

  useEffect(() => {
    if (!candidateKey) return undefined
    return subscribeSavedJobsSync((detail) => {
      if (!detail?.candidateKey || detail.candidateKey === candidateKey) reload()
    }, { sourceId: syncSourceId.current })
  }, [candidateKey, reload])

  const value = useMemo(
    () => ({ items, savedIds, pendingJobIds, loading, error, reload, toggle, isCandidate, saveSuccess }),
    [items, savedIds, pendingJobIds, loading, error, reload, toggle, isCandidate, saveSuccess],
  )

  return <SavedJobsContext.Provider value={value}>{children}</SavedJobsContext.Provider>
}
