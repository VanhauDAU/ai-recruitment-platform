import { EMPLOYER_CAPABILITIES } from '@/entities/employer-profile'
import EmployerCapabilityGuard from './EmployerCapabilityGuard'

export default function CandidateDataGuard() {
  return <EmployerCapabilityGuard capability={EMPLOYER_CAPABILITIES.CANDIDATE_DATA} />
}
