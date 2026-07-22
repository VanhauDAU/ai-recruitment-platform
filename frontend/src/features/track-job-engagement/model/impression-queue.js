import { recordJobImpressions } from '@/entities/job'

const MAX_BATCH_SIZE = 50
const FLUSH_DELAY_MS = 250
const queuedSlugs = new Set()
let flushTimer = null

export async function flushJobImpressions() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (!queuedSlugs.size) return

  const slugs = Array.from(queuedSlugs).slice(0, MAX_BATCH_SIZE)
  slugs.forEach((slug) => queuedSlugs.delete(slug))
  try {
    await recordJobImpressions(slugs)
  } catch {
    // Engagement tracking is progressive enhancement and never blocks the page.
  }
  if (queuedSlugs.size) scheduleFlush()
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(flushJobImpressions, FLUSH_DELAY_MS)
}

export function enqueueJobImpression(slug) {
  if (!slug) return
  queuedSlugs.add(slug)
  if (queuedSlugs.size >= MAX_BATCH_SIZE) {
    void flushJobImpressions()
    return
  }
  scheduleFlush()
}

export function resetJobImpressionQueue() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  queuedSlugs.clear()
}
