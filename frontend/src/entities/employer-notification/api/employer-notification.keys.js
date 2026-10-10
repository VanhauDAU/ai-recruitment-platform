export const employerNotificationKeys = {
  all: ['employer-notifications'],
  lists: () => [...employerNotificationKeys.all, 'list'],
  list: (page) => [...employerNotificationKeys.lists(), page],
  unread: () => [...employerNotificationKeys.all, 'unread'],
  preferences: () => [...employerNotificationKeys.all, 'preferences'],
  activities: () => [...employerNotificationKeys.all, 'activities'],
  activityList: (page) => [...employerNotificationKeys.activities(), page],
}
