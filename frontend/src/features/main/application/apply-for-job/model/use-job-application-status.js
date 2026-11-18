import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { applicationKeys, getCandidateApplications, useApplicationRules } from '@/entities/application/application'

/** `rules` comes from the server; until it loads only the server enforces the cap and cooldown. */
export function getJobApplicationStatus(applications, jobPublicId, now = Date.now(), rules) {
  const jobApplications = applications
    .filter((application) => application.job_public_id === jobPublicId)
    .sort((left, right) => new Date(right.applied_at) - new Date(left.applied_at))
  // One current application per job; older submissions are history.
  const current = jobApplications.find((application) => application.is_current !== false) || null
  const canResubmit = !current || Boolean(current.actions?.reapply)
  const retryCount = Math.max(0, jobApplications.length - 1)
  const retriesRemaining = rules
    ? Math.max(0, rules.max_submissions_per_job - jobApplications.length)
    : null
  const retryAvailableAt = rules && jobApplications[0]
    ? new Date(jobApplications[0].applied_at).getTime() + rules.reapply_cooldown_seconds * 1000
    : null
  const isPending = Boolean(current && !canResubmit)
  const isLimitReached = Boolean(current && canResubmit && retriesRemaining === 0)
  const isCoolingDown = Boolean(
    current && canResubmit && !isLimitReached && retryAvailableAt && retryAvailableAt > now,
  )

  return {
    latestApplication: current,
    hasApplied: Boolean(current),
    // Still in the recruiter's hands: to send another CV, withdraw it on the applied-jobs page first.
    isPending,
    isResubmission: Boolean(current && canResubmit),
    applyLabel: isPending ? 'Đã ứng tuyển' : current ? 'Ứng tuyển lại' : 'Ứng tuyển ngay',
    retryCount,
    retriesRemaining,
    isCoolingDown,
    isLimitReached,
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
  const rules = useApplicationRules()
  const status = useMemo(
    () => getJobApplicationStatus(applicationsQuery.data || [], jobPublicId, now, rules),
    [applicationsQuery.data, jobPublicId, now, rules],
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
