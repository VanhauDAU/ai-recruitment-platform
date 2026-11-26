import { useQuery } from '@tanstack/react-query'
import {
  announcementKeys,
  getActiveAnnouncements,
} from '@/entities/content/announcement'
import { useAnnouncementRuntimeHealth } from './use-announcement-runtime-health'

export function useAnnouncementFeed({
  audienceKey,
  locale,
  path,
  surface,
}) {
  const query = useQuery({
    queryKey: announcementKeys.active({ audienceKey, locale, path, surface }),
    queryFn: ({ signal }) => getActiveAnnouncements({
      locale,
      path,
      surface,
    }, { signal }),
    // Khoá theo path: mỗi lần đổi trang là một request. Thông báo ít khi đổi, quay
    // lại trang đã xem trong 5 phút thì dùng cache.
    staleTime: 5 * 60_000,
    retry: 1,
    retryDelay: 250,
  })
  useAnnouncementRuntimeHealth({
    error: query.error,
    isError: query.isError,
    surface,
  })
  return {
    feed: query.data,
    refetchFeed: query.refetch,
  }
}
