import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/entities/account/session'
import {
  ANNOUNCEMENT_SURFACES,
  announcementAudienceKey,
  announcementKeys,
  getAnnouncementInbox,
} from '@/entities/content/announcement'
import { getLocale } from '@/shared/config/i18n'

/** Announcements of the employer workspace for the signed-in recruiter. */
export default function useSystemAnnouncements() {
  const { user } = useSession()
  const surface = ANNOUNCEMENT_SURFACES.EMPLOYER_WORKSPACE
  const locale = getLocale()
  const query = useQuery({
    queryKey: announcementKeys.inbox({ surface, locale, audienceKey: announcementAudienceKey(user) }),
    queryFn: () => getAnnouncementInbox({ surface, locale }),
    staleTime: 60_000,
  })
  const items = query.data || []
  return { query, items, live: items.filter((item) => item.is_live) }
}
