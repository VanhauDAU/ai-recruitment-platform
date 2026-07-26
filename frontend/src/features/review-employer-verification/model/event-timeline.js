const GROUP_WINDOW_MS = 60_000

function sensitiveEventTitle(event) {
  if (event.payload?.audit_version !== 2) return 'Đã truy cập giấy tờ nhạy cảm'
  return event.payload?.action === 'download'
    ? 'Đã tải giấy tờ nhạy cảm'
    : 'Đã xem giấy tờ nhạy cảm'
}

function documentLabel(event, documentById) {
  const payload = event.payload || {}
  const document = documentById.get(payload.document_public_id)
  const typeLabel = payload.document_type_label || document?.doc_type_label
  const fileName = payload.document_file_name || document?.file_name
  return [typeLabel, fileName].filter(Boolean).join(' · ')
}

export function buildVerificationTimeline(events = [], documents = []) {
  const documentById = new Map(
    documents.map((document) => [document.public_id, document]),
  )
  const groups = []

  events.forEach((event) => {
    const isSensitive = event.event_type === 'sensitive_viewed'
    const timestamp = new Date(event.created_at).getTime()
    const item = {
      ...event,
      count: 1,
      title: isSensitive ? sensitiveEventTitle(event) : event.event_type_label,
      documentLabel: isSensitive ? documentLabel(event, documentById) : '',
      groupKey: isSensitive
        ? [
          event.actor_email || 'system',
          event.payload?.document_public_id || 'unknown',
          event.payload?.audit_version === 2 ? event.payload?.action : 'legacy-access',
        ].join(':')
        : '',
      timestamp,
    }
    const previous = groups.at(-1)
    const closeToPrevious = previous
      && Math.abs(previous.timestamp - timestamp) <= GROUP_WINDOW_MS

    if (
      isSensitive
      && previous?.event_type === 'sensitive_viewed'
      && previous.groupKey === item.groupKey
      && closeToPrevious
    ) {
      previous.count += 1
      return
    }
    groups.push(item)
  })

  return groups
}
