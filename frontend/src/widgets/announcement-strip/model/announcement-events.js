import { sendAnnouncementEvents } from '@/entities/announcement'

const FLUSH_DELAY_MS = 400
const MAX_BATCH_SIZE = 20
const pendingEvents = new Map()
let flushTimer = null

function eventKey(event) {
  return [
    event.public_id,
    event.revision,
    event.surface,
    event.event,
  ].join(':')
}

export function flushAnnouncementEvents() {
  if (flushTimer) {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }
  if (!pendingEvents.size) return
  const events = [...pendingEvents.values()]
  pendingEvents.clear()
  void sendAnnouncementEvents(events).catch(() => {
    // Analytics is best-effort. Never block navigation or retry indefinitely.
  })
}

export function queueAnnouncementEvent(item, surface, event) {
  if (item?.source !== 'remote' || !item.id || !item.revision) return
  const payload = {
    public_id: item.id,
    revision: item.revision,
    surface,
    event,
  }
  pendingEvents.set(eventKey(payload), payload)
  if (pendingEvents.size >= MAX_BATCH_SIZE) {
    flushAnnouncementEvents()
    return
  }
  if (!flushTimer) {
    flushTimer = window.setTimeout(flushAnnouncementEvents, FLUSH_DELAY_MS)
  }
}

export function resetAnnouncementEventsForTests() {
  if (flushTimer) window.clearTimeout(flushTimer)
  flushTimer = null
  pendingEvents.clear()
}
