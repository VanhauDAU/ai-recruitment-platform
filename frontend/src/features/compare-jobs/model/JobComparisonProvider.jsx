import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useConsent } from '@/entities/consent'
import JobComparisonContext from './comparison-context'
import {
  comparisonHasItem,
  comparisonItemFromJob,
  comparisonReducer,
  MAX_COMPARISON_JOBS,
} from './comparison-state'
import {
  clearComparisonStorage,
  COMPARISON_STORAGE_KEY,
  readComparisonStorage,
  writeComparisonStorage,
} from './comparison-storage'

export default function JobComparisonProvider({ children }) {
  const { consent, openSettings, status } = useConsent()
  const [items, dispatch] = useReducer(comparisonReducer, [])
  const [storageReady, setStorageReady] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const canPersist = status === 'ready' && consent.preferences === true

  useEffect(() => {
    if (status === 'loading') return
    if (canPersist) {
      dispatch({ type: 'hydrate-if-empty', items: readComparisonStorage() })
    } else {
      clearComparisonStorage()
    }
    setStorageReady(true)
  }, [canPersist, status])

  useEffect(() => {
    if (!storageReady || !canPersist) return
    writeComparisonStorage(items)
  }, [canPersist, items, storageReady])

  useEffect(() => {
    if (!canPersist) return undefined
    const onStorage = (event) => {
      if (event.key !== COMPARISON_STORAGE_KEY) return
      dispatch({ type: 'replace', items: readComparisonStorage() })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [canPersist])

  const hasJob = useCallback(
    (identifier) => comparisonHasItem(items, identifier),
    [items],
  )

  const toggleJob = useCallback((job) => {
    const item = comparisonItemFromJob(job)
    if (!item) return 'invalid'
    if (comparisonHasItem(items, item)) {
      dispatch({ type: 'remove', identifier: item })
      setAnnouncement(`Đã bỏ ${item.title} khỏi danh sách so sánh.`)
      return 'removed'
    }
    if (items.length >= MAX_COMPARISON_JOBS) {
      setAnnouncement(`Chỉ có thể so sánh tối đa ${MAX_COMPARISON_JOBS} việc làm.`)
      return 'limit'
    }
    dispatch({ type: 'add', job: item })
    setAnnouncement(`Đã thêm ${item.title} vào danh sách so sánh.`)
    return 'added'
  }, [items])

  const removeJob = useCallback((identifier) => {
    dispatch({ type: 'remove', identifier })
  }, [])

  const clearJobs = useCallback(() => {
    dispatch({ type: 'clear' })
    setAnnouncement('Đã xóa danh sách so sánh.')
  }, [])

  const replaceJobs = useCallback((jobs) => {
    dispatch({ type: 'replace', items: jobs })
  }, [])

  const value = useMemo(() => ({
    announcement,
    canCompare: items.length >= 2,
    clearJobs,
    hasJob,
    isFull: items.length >= MAX_COMPARISON_JOBS,
    items,
    maxJobs: MAX_COMPARISON_JOBS,
    openPreferenceSettings: openSettings,
    persistence: canPersist ? 'browser' : 'memory',
    removeJob,
    replaceJobs,
    toggleJob,
  }), [
    announcement,
    canPersist,
    clearJobs,
    hasJob,
    items,
    openSettings,
    removeJob,
    replaceJobs,
    toggleJob,
  ])

  return <JobComparisonContext.Provider value={value}>{children}</JobComparisonContext.Provider>
}
