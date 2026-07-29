import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  announcementKeys,
  createAdminAnnouncement,
  createAdminAnnouncementRevision,
  duplicateAdminAnnouncement,
  renameAdminAnnouncement,
  runAdminAnnouncementAction,
} from '@/entities/announcement'

function execute(action) {
  switch (action.type) {
    case 'create':
      return createAdminAnnouncement(action.payload)
    case 'rename':
      return renameAdminAnnouncement(action.publicId, action.payload)
    case 'revision':
      return createAdminAnnouncementRevision(action.publicId, action.payload)
    case 'duplicate':
      return duplicateAdminAnnouncement(action.publicId, action.payload)
    default:
      return runAdminAnnouncementAction(
        action.publicId,
        action.type,
        action.payload,
      )
  }
}

export function getAnnouncementStaleConflict(error) {
  if (
    error?.response?.status !== 409
    || error?.response?.data?.code !== 'announcement_revision_stale'
  ) {
    return null
  }
  return {
    detail: error.response.data.detail,
    currentRevisionToken: error.response.data.current_revision_token,
  }
}

export function useAnnouncementActions() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: execute,
    onSuccess: (detail) => {
      queryClient.setQueryData(
        announcementKeys.adminDetail(detail.public_id),
        detail,
      )
      return queryClient.invalidateQueries({
        queryKey: announcementKeys.adminLists(),
      })
    },
  })

  return {
    pending: mutation.isPending,
    pendingType: mutation.variables?.type || null,
    error: mutation.error,
    reset: mutation.reset,
    create: (payload) => mutation.mutateAsync({ type: 'create', payload }),
    rename: (publicId, payload) => mutation.mutateAsync({
      type: 'rename',
      publicId,
      payload,
    }),
    createRevision: (publicId, payload) => mutation.mutateAsync({
      type: 'revision',
      publicId,
      payload,
    }),
    publish: (publicId, payload) => mutation.mutateAsync({
      type: 'publish',
      publicId,
      payload,
    }),
    pause: (publicId, payload) => mutation.mutateAsync({
      type: 'pause',
      publicId,
      payload,
    }),
    resume: (publicId, payload) => mutation.mutateAsync({
      type: 'resume',
      publicId,
      payload,
    }),
    archive: (publicId, payload) => mutation.mutateAsync({
      type: 'archive',
      publicId,
      payload,
    }),
    duplicate: (publicId, payload) => mutation.mutateAsync({
      type: 'duplicate',
      publicId,
      payload,
    }),
  }
}
