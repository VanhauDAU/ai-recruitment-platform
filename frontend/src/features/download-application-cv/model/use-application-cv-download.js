import { useEffect, useRef, useState } from 'react'
import {
  downloadApplicationCv,
  getApplicationCvExport,
  requestApplicationCvExport,
} from '@/entities/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { triggerBlobDownload } from '@/shared/lib/download-blob'
import { message } from '@/shared/lib/toast'

const POLL_INTERVAL_MS = 2_000
const TIMEOUT_MS = 60_000
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

/** Render (or reuse) the submitted CV as PDF, poll until ready, then save it. */
export default function useApplicationCvDownload(publicId, filename) {
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
      const deadline = Date.now() + TIMEOUT_MS
      let job = await requestApplicationCvExport(publicId)
      while (!job.download_url) {
        if (job.status === 'failed') throw new Error('Không tạo được PDF cho CV này.')
        if (Date.now() > deadline) throw new Error('Tạo PDF đang lâu hơn dự kiến. Vui lòng thử lại.')
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
      message.error(error.response ? getApiErrorMessage(error, 'Không thể tải CV.') : error.message)
    }
  }

  return { download, working: state === 'working', failed: state === 'error' }
}
