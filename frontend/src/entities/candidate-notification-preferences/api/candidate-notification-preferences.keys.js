export const candidateNotificationPreferenceKeys = {
  all: ['candidate-notification-preferences'],
  preferences: () => [...candidateNotificationPreferenceKeys.all, 'preferences'],
}

export const candidateNotificationPreferenceMutationKey = [
  ...candidateNotificationPreferenceKeys.all,
  'update',
]

export const candidateNotificationPreferenceMutationScope = {
  id: 'candidate-notification-preferences-update',
}
