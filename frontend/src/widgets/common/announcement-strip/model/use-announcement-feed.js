import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  announcementKeys,
  getActiveAnnouncements,
} from '@/entities/content/announcement'
import { useAnnouncementRuntimeHealth } from './use-announcement-runtime-health'

export const ANNOUNCEMENT_POLL_MS = 60_000

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
    retry: 1,
    retryDelay: 250,
  })
  useAnnouncementRuntimeHealth({
    error: query.error,
    isError: query.isError,
    surface,
  })
  const { dataUpdatedAt, refetch } = query
  return {
    feed: query.data,
    refetchFeed: refetch,
    // Quay lại tab: chỉ hỏi lại khi lần tải gần nhất đã quá một chu kỳ poll, đổi tab
    // qua lại liên tục không bắn mỗi lần một request.
    refetchFeedIfStale: useCallback(
      () => (Date.now() - dataUpdatedAt >= ANNOUNCEMENT_POLL_MS ? refetch() : undefined),
      [dataUpdatedAt, refetch],
    ),
  }
}
