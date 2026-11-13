import { EMPLOYER_CAPABILITIES } from '@/entities/employer-profile'
import EmployerCapabilityGuard from './EmployerCapabilityGuard'

export default function JobWorkspaceGuard() {
  return <EmployerCapabilityGuard capability={EMPLOYER_CAPABILITIES.JOB_WORKSPACE} />
}
