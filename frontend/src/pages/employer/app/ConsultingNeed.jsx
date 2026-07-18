import { Navigate } from 'react-router-dom'
import { useState } from 'react'
import { EmployerConsultingNeedPanel } from '@/widgets/employer-consulting-need'
import { useSession } from '@/entities/session'
import { EMPLOYER_ACCOUNT_VERIFY_URL, EMPLOYER_COMPLETE_PROFILE_URL, employerAppPath } from '@/shared/config/portals'

export default function EmployerConsultingNeed() {
  const { user } = useSession()
  const [isCompleting, setIsCompleting] = useState(false)

  if (user?.employer_onboarding_step === 'registration') {
    return <Navigate to={EMPLOYER_COMPLETE_PROFILE_URL} replace />
  }
  if (user?.employer_onboarding_step === 'email_verification') {
    return <Navigate to={EMPLOYER_ACCOUNT_VERIFY_URL} replace />
  }
  if (user?.employer_onboarding_step === 'complete' && !isCompleting) {
    return <Navigate to={employerAppPath('/dashboard')} replace />
  }

  return <EmployerConsultingNeedPanel onCompleted={() => setIsCompleting(true)} />
}
