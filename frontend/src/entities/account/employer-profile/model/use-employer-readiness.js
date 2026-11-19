import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getEmployerProfile } from '../api/employer-profile.api'
import { employerProfileKeys } from '../api/employer-profile.keys'
import { resolveEmployerReadiness } from './employer-readiness'

export function useEmployerReadiness() {
  const profileQuery = useQuery({
    queryKey: employerProfileKeys.profile,
    queryFn: getEmployerProfile,
  })
  const readiness = useMemo(
    () => resolveEmployerReadiness(profileQuery.data),
    [profileQuery.data],
  )
  const isAccessError = Boolean(
    profileQuery.error || profileQuery.isError || profileQuery.isRefetchError,
  )
  const isChecking = Boolean(profileQuery.isPending || profileQuery.isFetching)

  return {
    profile: profileQuery.data,
    profileQuery,
    readiness,
    isAccessError,
    isChecking,
    canUseJobWorkspace: Boolean(
      !isAccessError && !isChecking && readiness.jobWorkspaceReady,
    ),
    canAccessCandidateData: Boolean(
      !isAccessError && !isChecking && readiness.candidateDataAccess,
    ),
  }
}
