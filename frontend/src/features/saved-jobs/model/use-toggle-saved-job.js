import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { saveJob, unsaveJob } from '../api/saved-jobs.api'
import { savedJobsKeys } from '../api/saved-jobs.keys'

const withoutJob = (items, publicId) => items.filter((item) => item.job_detail?.public_id !== publicId)

export default function useToggleSavedJob({ candidateKey, items, publish }) {
  // Ref chặn double-click gửi trùng request trước khi state kịp re-render.
  const pendingJobIdsRef = useRef(new Set())
  const [pendingJobIds, setPendingJobIds] = useState(() => new Set())
  const [saveSuccess, setSaveSuccess] = useState(null)
  const [error, setError] = useState(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    pendingJobIdsRef.current.clear()
    setPendingJobIds(new Set())
    setError(null)
  }, [candidateKey])

  const mutation = useMutation({
    mutationFn: ({ publicId, saved }) => (saved ? unsaveJob(publicId) : saveJob(publicId)),
    onMutate: async ({ publicId, saved }) => {
      const queryKey = savedJobsKeys.list(candidateKey)
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey) ?? []
      const rest = withoutJob(previous, publicId)
      queryClient.setQueryData(queryKey, saved ? rest : [{ job_detail: { public_id: publicId } }, ...rest])
      return { previous, queryKey }
    },
    onSuccess: (created, { publicId, saved }, { queryKey }) => {
      if (!saved && created) {
        queryClient.setQueryData(queryKey, (current = []) => [created, ...withoutJob(current, publicId)])
        setSaveSuccess({ publicId, at: Date.now() })
      }
      setError(null)
      publish()
    },
    onError: (nextError, _variables, { previous, queryKey }) => {
      queryClient.setQueryData(queryKey, previous)
      setError(nextError)
    },
    onSettled: (_data, _error, { publicId }) => {
      pendingJobIdsRef.current.delete(publicId)
      setPendingJobIds((current) => {
        const next = new Set(current)
        next.delete(publicId)
        return next
      })
    },
  })

  const toggle = useCallback(async (publicId) => {
    if (!candidateKey || !publicId || pendingJobIdsRef.current.has(publicId)) return
    pendingJobIdsRef.current.add(publicId)
    setPendingJobIds((current) => new Set(current).add(publicId))
    const saved = items.some((item) => item.job_detail?.public_id === publicId)
    try {
      await mutation.mutateAsync({ publicId, saved })
    } catch {
      // lỗi đã được onError xử lý (rollback + setError); nuốt để giữ contract cũ
    }
  }, [candidateKey, items, mutation])

  return { pendingJobIds, saveSuccess, toggle, error }
}
