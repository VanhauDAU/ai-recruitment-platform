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
}

export function announcementAudienceKey(user) {
  if (!user) return 'guest'
  return `${user.role || 'authenticated'}:${user.public_id || 'session'}`
}
