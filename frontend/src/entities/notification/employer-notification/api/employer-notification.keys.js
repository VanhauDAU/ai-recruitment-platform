export const employerNotificationKeys = {
  all: ['employer-notifications'],
  lists: () => [...employerNotificationKeys.all, 'list'],
  list: (params = {}) => [...employerNotificationKeys.lists(), params],
  // Infinite pages of the notification page; kept apart from the bell's single page.
  feed: (params = {}) => [...employerNotificationKeys.lists(), 'feed', params],
  unread: () => [...employerNotificationKeys.all, 'unread'],
  preferences: () => [...employerNotificationKeys.all, 'preferences'],
  activities: () => [...employerNotificationKeys.all, 'activities'],
  activityList: (params = {}) => [...employerNotificationKeys.activities(), params],
}
