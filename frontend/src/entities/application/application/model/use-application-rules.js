import { useQuery } from '@tanstack/react-query'
import { getApplicationRules } from '../api/application.api'
import { applicationKeys } from '../api/application.keys'

/** Server-owned limits; `undefined` until loaded, so callers never copy them. */
export function useApplicationRules() {
  return useQuery({
    queryKey: applicationKeys.rules,
    queryFn: getApplicationRules,
    staleTime: Infinity,
  }).data
}
