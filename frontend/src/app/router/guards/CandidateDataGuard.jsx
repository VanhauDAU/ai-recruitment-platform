import { EMPLOYER_CAPABILITIES } from '@/entities/account/employer-profile'
import EmployerCapabilityGuard from './EmployerCapabilityGuard'

export default function CandidateDataGuard() {
  return <EmployerCapabilityGuard capability={EMPLOYER_CAPABILITIES.CANDIDATE_DATA} />
}
