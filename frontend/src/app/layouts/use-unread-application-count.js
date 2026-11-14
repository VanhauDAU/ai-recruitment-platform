import { useQuery } from '@tanstack/react-query'
import { applicationKeys, getRecruiterApplicationPage } from '@/entities/application'

/**
 * CVs no one has opened yet, across all of the recruiter's jobs. A one-row
 * page is enough: only `count` is read. Disabled without candidate-data
 * access, where the endpoint answers 403.
 */
export default function useUnreadApplicationCount(enabled) {
  const query = useQuery({
    queryKey: applicationKeys.recruiterUnreadCount(),
    queryFn: () => getRecruiterApplicationPage({ scope: 'unread', page_size: 1 }),
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  return query.data?.count || 0
}
