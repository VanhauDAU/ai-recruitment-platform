import { Navigate, useLocation } from 'react-router-dom'
import { employerAppPath } from '@/shared/config/portals'

export default function EmployerLegacyVerifyRedirect() {
  const { search } = useLocation()
  return <Navigate to={`${employerAppPath('/account/verify')}${search}`} replace />
}
