import { useEffect, useState } from 'react'
import { getMessageFile } from '@/entities/messaging/conversation'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { triggerBlobDownload } from '@/shared/lib/download-blob'
import { message as toast } from '@/shared/lib/toast'

/**
 * Object URL of an image message. The file endpoint needs the Bearer token, so
 * it is fetched as a blob; an image still uploading shows the local file.
 */
export function useMessageImageUrl(portal, conversationId, message) {
  const [remote, setRemote] = useState({ id: '', url: '', failed: false })
  const localFile = message.payload?.file
  const messageId = localFile ? '' : message.public_id
  // Ảnh đang tải lên: URL tạm của tệp cục bộ, thu hồi khi đổi/huỷ.
  const [localUrl] = useState(() => (localFile ? URL.createObjectURL(localFile) : ''))
  useEffect(() => () => {
    if (localUrl) URL.revokeObjectURL(localUrl)
  }, [localUrl])

  useEffect(() => {
    if (!messageId) return undefined
    let url = ''
    let cancelled = false
    getMessageFile(portal, conversationId, messageId)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setRemote({ id: messageId, url, failed: false })
      })
      .catch(() => !cancelled && setRemote({ id: messageId, url: '', failed: true }))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [conversationId, messageId, portal])

  if (localUrl) return { url: localUrl, failed: false }
  return remote.id === messageId ? remote : { url: '', failed: false }
}

/** Save an attachment or CV file of a delivered message. */
export async function downloadMessageFile(portal, conversationId, message, filename) {
  try {
    const blob = await getMessageFile(portal, conversationId, message.public_id, { download: true })
    triggerBlobDownload(blob, filename)
  } catch (error) {
    toast.error(getApiErrorMessage(error, m.connect_file_download_failed()))
  }
}
