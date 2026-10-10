import { Navigate, Outlet } from 'react-router'
import {
  EMPLOYER_CAPABILITIES,
  EmployerReadinessGateState,
  useEmployerReadiness,
} from '@/entities/employer-profile'
import { EMPLOYER_VERIFY_URL } from '@/shared/config/portals'

const ACCESS_FIELDS = {
  [EMPLOYER_CAPABILITIES.JOB_WORKSPACE]: 'canUseJobWorkspace',
  [EMPLOYER_CAPABILITIES.CANDIDATE_DATA]: 'canAccessCandidateData',
}

export default function EmployerCapabilityGuard({ capability }) {
  const state = useEmployerReadiness()
  const accessField = ACCESS_FIELDS[capability]

  if (state.isChecking || state.isAccessError) {
    return (
      <EmployerReadinessGateState
        capability={capability}
        checking={state.isChecking}
        error={state.isAccessError}
        readiness={state.readiness}
        onRetry={() => state.profileQuery.refetch()}
      />
    )
  }

  if (accessField && state[accessField]) return <Outlet />

  return <Navigate to={EMPLOYER_VERIFY_URL} replace />
}
