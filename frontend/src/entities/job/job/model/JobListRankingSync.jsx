import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { isDefaultJobListQuery } from '../api/job.keys'
import { subscribeJobListRankingChanged } from './job-list-ranking-sync'

export default function JobListRankingSync() {
  const queryClient = useQueryClient()

  useEffect(() => subscribeJobListRankingChanged(() => {
    void queryClient.invalidateQueries({ predicate: isDefaultJobListQuery })
  }), [queryClient])

  return null
}
