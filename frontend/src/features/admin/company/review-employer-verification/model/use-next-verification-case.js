import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  adminEmployerVerificationKeys,
  getAdminEmployerVerifications,
} from '@/entities/company/admin-employer-verification'
import { adminPath } from '@/shared/config/portals'
import { pickNextCase } from './next-case'

const NEXT_CASE_PARAMS = { status: 'actionable', ordering: 'submitted_at', page_size: 3 }

/**
 * After a decision, offer the next case in the queue so the admin never has
 * to go back to the list. Navigation keeps `location.state` so "Quay lại"
 * still returns to wherever the admin started.
 */
export default function useNextVerificationCase(currentCaseId, { enabled }) {
  const navigate = useNavigate()
  const location = useLocation()
  const query = useQuery({
    queryKey: adminEmployerVerificationKeys.list(NEXT_CASE_PARAMS),
    queryFn: ({ signal }) => getAdminEmployerVerifications(NEXT_CASE_PARAMS, { signal }),
    enabled,
    staleTime: 0,
  })
  const { next, remaining } = pickNextCase(query.data, currentCaseId)
  const goNext = useCallback(() => {
    if (!next) return
    navigate(`${adminPath(`/nha-tuyen-dung/${next.user_public_id}`)}?tab=verification`, {
      state: location.state,
    })
  }, [location.state, navigate, next])
  return { goNext, loading: query.isFetching, next, remaining }
}
