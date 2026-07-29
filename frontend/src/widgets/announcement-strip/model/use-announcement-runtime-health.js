import { useEffect } from 'react'
import { reportAnnouncementRuntimeEvent } from '@/entities/announcement'

function failureReason(error) {
  const status = Number(error?.response?.status)
  if (status >= 500) return 'http_5xx'
  if (status >= 400) return 'http_4xx'
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return 'timeout'
  if (!error?.response) return 'network'
  return 'unknown'
}

export function reportAnnouncementRuntimeIssue(payload) {
  void reportAnnouncementRuntimeEvent(payload).catch(() => {
    // Operational telemetry is best-effort and must never affect the header.
  })
}

export function useAnnouncementRuntimeHealth({ error, isError, surface }) {
  useEffect(() => {
    if (!isError) return
    reportAnnouncementRuntimeIssue({
      surface,
      event: 'feed_error',
      reason: failureReason(error),
    })
  }, [error, isError, surface])
}
