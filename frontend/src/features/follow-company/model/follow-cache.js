import { companyKeys } from '@/entities/company'
import { followCompanyKeys } from '../api/follow-company.keys'

const cacheFilters = (publicId) => [
  { queryKey: followCompanyKeys.status(publicId) },
  { queryKey: companyKeys.details },
  { queryKey: followCompanyKeys.followedLists },
]

/** Mọi cache mà một lần đổi trạng thái theo dõi chạm tới, chụp lại để hoàn tác khi lỗi. */
export function snapshotFollowCaches(queryClient, publicId) {
  return cacheFilters(publicId).flatMap((filters) => queryClient.getQueriesData(filters))
}

export function restoreFollowCaches(queryClient, snapshot) {
  snapshot.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data))
}

/**
 * Đồng bộ các bề mặt khác đang hiển thị công ty này: số người theo dõi trên
 * trang công ty và dòng tương ứng trong danh sách "đang theo dõi" (bỏ theo dõi
 * thì dòng biến mất). `followerCount` nhận số đang có trong cache và trả số mới.
 */
export function writeFollowSurfaces(queryClient, publicId, { following, notify_new_jobs }, followerCount) {
  queryClient.setQueriesData({ queryKey: companyKeys.details }, (profile) => (
    profile?.public_id === publicId
      ? { ...profile, stats: { ...profile.stats, follower_count: followerCount(profile.stats?.follower_count) } }
      : profile
  ))
  queryClient.setQueriesData({ queryKey: followCompanyKeys.followedLists }, (page) => {
    if (!page?.results) return page
    const results = following
      ? page.results.map((company) => (company.public_id === publicId ? { ...company, notify_new_jobs } : company))
      : page.results.filter((company) => company.public_id !== publicId)
    return { ...page, results, count: page.count - (page.results.length - results.length) }
  })
}
