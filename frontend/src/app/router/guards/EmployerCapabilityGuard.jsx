import { Outlet } from 'react-router'
import {
  EMPLOYER_CAPABILITIES,
  EmployerReadinessGateState,
  useEmployerReadiness,
} from '@/entities/employer-profile'

const ACCESS_FIELDS = {
  [EMPLOYER_CAPABILITIES.JOB_WORKSPACE]: 'canUseJobWorkspace',
  [EMPLOYER_CAPABILITIES.CANDIDATE_DATA]: 'canAccessCandidateData',
}

export default function EmployerCapabilityGuard({ capability }) {
  const state = useEmployerReadiness()
  const accessField = ACCESS_FIELDS[capability]

  if (accessField && state[accessField]) return <Outlet />

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
