import { useEffect, useRef, useState } from 'react'
import {
  downloadApplicationCv,
  getApplicationCvExport,
  getApplicationCvFile,
  requestApplicationCvExport,
} from '@/entities/application/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { triggerBlobDownload } from '@/shared/lib/download-blob'
import { message } from '@/shared/lib/toast'
import { m } from '@/shared/config/i18n'

const POLL_INTERVAL_MS = 2_000
const TIMEOUT_MS = 60_000
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

/**
 * Save the submitted CV as PDF. A builder CV is rendered (or reused) on the
 * server and polled until ready; an uploaded CV (`sourceFile`) is the file itself.
 */
export default function useApplicationCvDownload(publicId, filename, { sourceFile = false } = {}) {
  const [state, setState] = useState('idle')
  const runRef = useRef(0)

  // A run belongs to one application; switching CV or unmounting abandons it.
  useEffect(() => {
    runRef.current += 1
    setState('idle')
  }, [publicId])
  useEffect(() => () => { runRef.current += 1 }, [])

  async function download() {
    if (!publicId || state === 'working') return
    const run = ++runRef.current
    setState('working')
    try {
      if (sourceFile) {
        const file = await getApplicationCvFile(publicId, { download: true })
        if (run !== runRef.current) return
        triggerBlobDownload(file, filename)
        setState('idle')
        return
      }
      const deadline = Date.now() + TIMEOUT_MS
      let job = await requestApplicationCvExport(publicId)
      while (!job.download_url) {
        if (job.status === 'failed') throw new Error(m.employer_workspace_download_pdf_failed())
        if (Date.now() > deadline) throw new Error(m.employer_workspace_download_pdf_timeout())
        await wait(POLL_INTERVAL_MS)
        if (run !== runRef.current) return
        job = await getApplicationCvExport(publicId, job.public_id)
      }
      const blob = await downloadApplicationCv(job.download_url)
      if (run !== runRef.current) return
      triggerBlobDownload(blob, filename)
      setState('idle')
    } catch (error) {
      if (run !== runRef.current) return
      setState('error')
      message.error(error.response ? getApiErrorMessage(error, m.employer_workspace_download_error()) : error.message)
    }
  }

  return { download, working: state === 'working', failed: state === 'error' }
}
