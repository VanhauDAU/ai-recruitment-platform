import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { applicationKeys, getCandidateApplications } from '@/entities/application'

export const MAX_APPLICATIONS_PER_JOB = 3
export const REAPPLICATION_COOLDOWN_MS = 5 * 60 * 1000

export function getJobApplicationStatus(applications, jobPublicId, now = Date.now()) {
  const jobApplications = applications
    .filter((application) => application.job_public_id === jobPublicId)
    .sort((left, right) => new Date(right.applied_at) - new Date(left.applied_at))
  const latestApplication = jobApplications[0] || null
  const retryCount = Math.max(0, jobApplications.length - 1)
  const retriesRemaining = Math.max(0, MAX_APPLICATIONS_PER_JOB - jobApplications.length)
  const retryAvailableAt = latestApplication
    ? new Date(latestApplication.applied_at).getTime() + REAPPLICATION_COOLDOWN_MS
    : null
  const isCoolingDown = Boolean(
    retriesRemaining > 0 && retryAvailableAt && retryAvailableAt > now,
  )

  return {
    latestApplication,
    hasApplied: jobApplications.length > 0,
    retryCount,
    retriesRemaining,
    isCoolingDown,
    isLimitReached: jobApplications.length >= MAX_APPLICATIONS_PER_JOB,
    retryAvailableAt,
  }
}

export function useJobApplicationStatus({ jobPublicId, enabled }) {
  const queryClient = useQueryClient()
  const [now, setNow] = useState(() => Date.now())
  const applicationsQuery = useQuery({
    queryKey: applicationKeys.candidateList,
    queryFn: getCandidateApplications,
    enabled: Boolean(enabled && jobPublicId),
  })
  const status = useMemo(
    () => getJobApplicationStatus(applicationsQuery.data || [], jobPublicId, now),
    [applicationsQuery.data, jobPublicId, now],
  )

  useEffect(() => {
    if (!status.isCoolingDown || !status.retryAvailableAt) return undefined
    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, status.retryAvailableAt - Date.now()) + 50,
    )
    return () => window.clearTimeout(timeout)
  }, [status.isCoolingDown, status.retryAvailableAt])

  function recordSubmission(application) {
    queryClient.setQueryData(applicationKeys.candidateList, (current = []) => [application, ...current])
    setNow(Date.now())
  }

  return {
    ...status,
    isLoading: applicationsQuery.isLoading,
    recordSubmission,
  }
}
