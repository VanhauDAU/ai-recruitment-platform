export const announcementKeys = {
  all: ['announcements'],
  active: ({ audienceKey, locale, path, surface }) => [
    ...announcementKeys.all,
    'active',
    surface,
    path,
    locale,
    audienceKey,
  ],
  admin: () => [...announcementKeys.all, 'admin'],
  adminLists: () => [...announcementKeys.admin(), 'list'],
  adminList: (params) => [...announcementKeys.adminLists(), params],
  adminDetails: () => [...announcementKeys.admin(), 'detail'],
  adminDetail: (publicId) => [...announcementKeys.adminDetails(), publicId],
  adminMetrics: (publicId, params) => [
    ...announcementKeys.admin(),
    'metrics',
    publicId,
    params,
  ],
}

export function announcementAudienceKey(user) {
  if (!user) return 'guest'
  return `${user.role || 'authenticated'}:${user.public_id || 'session'}`
}
