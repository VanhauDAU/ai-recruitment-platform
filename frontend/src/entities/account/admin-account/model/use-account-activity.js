import { useInfiniteQuery } from '@tanstack/react-query'
import { getAdminAccountActivity } from '../api/admin-account.api'
import { adminAccountKeys } from '../api/admin-account.keys'

/** Cursor-paginated activity timeline; `counts` come from the first page. */
export default function useAccountActivity(publicId, { category = '', limit = 30 } = {}) {
  const query = useInfiniteQuery({
    queryKey: adminAccountKeys.activity(publicId, { category, limit }),
    queryFn: ({ pageParam, signal }) => getAdminAccountActivity(
      publicId,
      { before: pageParam, category, limit },
      { signal },
    ),
    initialPageParam: '',
    getNextPageParam: (page) => page.next_cursor || undefined,
    enabled: Boolean(publicId),
  })
  const pages = query.data?.pages || []
  return {
    ...query,
    counts: pages[0]?.category_counts,
    entries: pages.flatMap((page) => page.results),
  }
}
