import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  candidateNotificationPreferenceKeys,
  candidateNotificationPreferenceMutationKey,
  candidateNotificationPreferenceMutationScope,
  getCandidateNotificationPreferences,
  PREFERENCE_ISSUES,
  preferenceErrorCode,
  updateCandidateNotificationPreferences,
} from '@/entities/notification/candidate-notification-preferences'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { SETTING_LABELS } from './notification-setting-groups'

/**
 * Each switch saves on its own. The shared mutation scope runs the PATCHes one
 * after another, so other switches stay usable while one is saving.
 */
export default function useNotificationSettings() {
  const queryClient = useQueryClient()
  const queryKey = candidateNotificationPreferenceKeys.preferences()
  const [issues, setIssues] = useState({})
  const query = useQuery({ queryKey, queryFn: getCandidateNotificationPreferences, retry: false })
  const savingFields = useMutationState({
    filters: { mutationKey: candidateNotificationPreferenceMutationKey, status: 'pending' },
    select: (mutation) => mutation.state.variables?.field,
  })

  const mutation = useMutation({
    mutationKey: candidateNotificationPreferenceMutationKey,
    scope: candidateNotificationPreferenceMutationScope,
    mutationFn: ({ field, enabled }) => updateCandidateNotificationPreferences({ [field]: enabled }),
    onMutate: async ({ field, enabled }) => {
      setIssues((current) => ({ ...current, [field]: undefined }))
      await queryClient.cancelQueries({ queryKey })
      const previousValue = queryClient.getQueryData(queryKey)?.[field]
      queryClient.setQueryData(queryKey, (current) => ({ ...current, [field]: enabled }))
      return { previousValue }
    },
    onSuccess: (saved, { field, enabled }) => {
      queryClient.setQueryData(queryKey, (current) => ({ ...current, ...saved }))
      if (enabled) message.success(`Đã bật: ${SETTING_LABELS[field]}.`)
    },
    onError: (error, { field }, context) => {
      queryClient.setQueryData(queryKey, (current) => ({ ...current, [field]: context?.previousValue }))
      const code = preferenceErrorCode(error)
      if (PREFERENCE_ISSUES[code]) {
        setIssues((current) => ({ ...current, [field]: code }))
        return
      }
      message.error(getApiErrorMessage(error, 'Không thể lưu lựa chọn này. Thay đổi đã được hoàn tác.'))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    query,
    preferences: query.data,
    issues,
    isSaving: (field) => savingFields.includes(field),
    change: (field, enabled) => mutation.mutate({ field, enabled }),
  }
}
