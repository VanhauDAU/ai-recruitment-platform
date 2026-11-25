import { useCallback, useEffect, useRef, useState } from 'react'
import {
  downloadMessageCvExport,
  getMessageCvExport,
  requestMessageCvExport,
} from '@/entities/messaging/conversation'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { triggerBlobDownload } from '@/shared/lib/download-blob'
import { message as toast } from '@/shared/lib/toast'

const POLL_MS = 2_000
const MAX_POLLS = 45

const wait = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms) })

/**
 * PDF of a CV built with the CV builder: request an export, poll until it is
 * ready, then download it with the Bearer token. Unmounting stops the polling.
 */
export function useCvExport(conversationId, message) {
  const messageId = message.public_id
  const filename = `${message.cv?.title || 'cv'}.pdf`
  const [exporting, setExporting] = useState(false)
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const exportPdf = useCallback(async () => {
    setExporting(true)
    try {
      let job = await requestMessageCvExport(conversationId, messageId)
      for (let poll = 0; job.status !== 'completed' && job.status !== 'failed' && poll < MAX_POLLS; poll += 1) {
        await wait(POLL_MS)
        if (!aliveRef.current) return
        job = await getMessageCvExport(conversationId, messageId, job.public_id)
      }
      if (job.status !== 'completed' || !job.download_url) throw new Error(job.status)
      const blob = await downloadMessageCvExport(job.download_url)
      triggerBlobDownload(blob, filename)
    } catch (error) {
      if (aliveRef.current) toast.error(getApiErrorMessage(error, m.connect_cv_export_failed()))
    } finally {
      if (aliveRef.current) setExporting(false)
    }
  }, [conversationId, filename, messageId])

  return { exportPdf, exporting }
}
