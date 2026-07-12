import { useCallback, useEffect, useRef, useState } from 'react'
import { saveJob, unsaveJob } from '../api/saved-jobs.api'

export default function useToggleSavedJob({ candidateKey, items, setError, setItems, publish }) {
  const candidateKeyRef = useRef(candidateKey)
  const pendingJobIdsRef = useRef(new Set())
  const [pendingJobIds, setPendingJobIds] = useState(() => new Set())
  const [saveSuccess, setSaveSuccess] = useState(null)

  useEffect(() => {
    candidateKeyRef.current = candidateKey
    pendingJobIdsRef.current.clear()
    setPendingJobIds(new Set())
  }, [candidateKey])

  const toggle = useCallback(async (publicId) => {
    if (!candidateKey || !publicId || pendingJobIdsRef.current.has(publicId)) return

    const isCurrentCandidate = () => candidateKeyRef.current === candidateKey
    const saved = items.some((item) => item.job_detail?.public_id === publicId)
    pendingJobIdsRef.current.add(publicId)
    setPendingJobIds((previous) => new Set(previous).add(publicId))

    if (saved) {
      const removedItem = items.find((item) => item.job_detail?.public_id === publicId)
      setItems((previous) => previous.filter((item) => item.job_detail?.public_id !== publicId))
      try {
        await unsaveJob(publicId)
        if (isCurrentCandidate()) publish()
      } catch (nextError) {
        if (isCurrentCandidate()) {
          if (removedItem) setItems((previous) => [removedItem, ...previous.filter((item) => item.job_detail?.public_id !== publicId)])
          setError(nextError)
        }
      } finally {
        pendingJobIdsRef.current.delete(publicId)
        if (isCurrentCandidate()) setPendingJobIds((previous) => {
          const next = new Set(previous)
          next.delete(publicId)
          return next
        })
      }
      return
    }

    const optimisticItem = { job_detail: { public_id: publicId } }
    setItems((previous) => [optimisticItem, ...previous.filter((item) => item.job_detail?.public_id !== publicId)])
    try {
      const created = await saveJob(publicId)
      if (!isCurrentCandidate()) return
      setItems((previous) => [created, ...previous.filter((item) => item.job_detail?.public_id !== publicId)])
      setSaveSuccess({ publicId, at: Date.now() })
      setError(null)
      publish()
    } catch (nextError) {
      if (isCurrentCandidate()) {
        setItems((previous) => previous.filter((item) => item.job_detail?.public_id !== publicId))
        setError(nextError)
      }
    } finally {
      pendingJobIdsRef.current.delete(publicId)
      if (isCurrentCandidate()) setPendingJobIds((previous) => {
        const next = new Set(previous)
        next.delete(publicId)
        return next
      })
    }
  }, [candidateKey, items, publish, setError, setItems])

  return { pendingJobIds, saveSuccess, toggle }
}
