import api from '@/shared/api/client'

// Hợp đồng: docs/04-api/procv-connect-contract.md. `portal` = 'candidate' | 'employer'.
const base = (portal) => `/${portal}/conversations`
const messagesPath = (portal, publicId) => `${base(portal)}/${publicId}/messages/`

export async function getConversations(portal, { q = '', page = 1 } = {}) {
  const { data } = await api.get(`${base(portal)}/`, { params: { q: q || undefined, page } })
  return data
}

/** Candidate: `{ job }`; employer: `{ application }` or `{ invitation }`. 201 new, 200 existing. */
export async function startConversation(portal, payload) {
  const { data } = await api.post(`${base(portal)}/`, payload)
  return data
}

export async function getConversationUnreadCount(portal) {
  const { data } = await api.get(`${base(portal)}/unread-count/`)
  return data
}

export async function getConversation(portal, publicId) {
  const { data } = await api.get(`${base(portal)}/${publicId}/`)
  return data
}

/** `{ results (seq ascending), has_more }`; `before` pages back, `after` fills a gap. */
export async function getConversationMessages(portal, publicId, { before, after, limit = 30 } = {}) {
  const { data } = await api.get(messagesPath(portal, publicId), { params: { before, after, limit } })
  return data
}

/** JSON message (`text`, `job`, `cv`), or a `File` sent as multipart (`file`/`image`). */
export async function sendConversationMessage(portal, publicId, { file, ...payload }) {
  if (file) {
    const form = new FormData()
    form.append('client_id', payload.client_id)
    form.append('file', file)
    const { data } = await api.post(messagesPath(portal, publicId), form)
    return data
  }
  const { data } = await api.post(messagesPath(portal, publicId), payload)
  return data
}

export async function markConversationRead(portal, publicId, seq) {
  await api.post(`${base(portal)}/${publicId}/read/`, { seq })
}

/** Attachment, image or CV file of a message, through the member-checked stream. */
export async function getMessageFile(portal, publicId, messageId, { download = false } = {}) {
  const { data } = await api.get(`${base(portal)}/${publicId}/messages/${messageId}/file/`, {
    params: download ? { download: 1 } : undefined,
    responseType: 'blob',
  })
  return data
}

export async function requestMessageCvExport(publicId, messageId) {
  const { data } = await api.post(`${base('employer')}/${publicId}/messages/${messageId}/cv-export/`)
  return data
}

export async function getMessageCvExport(publicId, messageId, exportId) {
  const { data } = await api.get(`${base('employer')}/${publicId}/messages/${messageId}/cv-export/${exportId}/`)
  return data
}

/** `downloadUrl` is the URL an export returned; it still needs the Bearer token. */
export async function downloadMessageCvExport(downloadUrl) {
  const { data } = await api.get(downloadUrl, { responseType: 'blob' })
  return data
}

export async function getConnectAppliedJobs() {
  const { data } = await api.get(`${base('candidate')}/applied-jobs/`)
  return data
}

export async function getShareableCvs() {
  const { data } = await api.get(`${base('candidate')}/shareable-cvs/`)
  return data
}

export async function getShareableJobs() {
  const { data } = await api.get(`${base('employer')}/shareable-jobs/`)
  return data
}

/** Returns the interview Message (`kind=interview`). */
export async function scheduleInterview(publicId, payload) {
  const { data } = await api.post(`${base('employer')}/${publicId}/interviews/`, payload)
  return data
}

export async function cancelInterview(interviewId, note = '') {
  const { data } = await api.post(`/employer/interviews/${interviewId}/cancel/`, note ? { note } : {})
  return data
}

/** `action`: accept | decline | reschedule. */
export async function respondToInterview(interviewId, { action, note = '' }) {
  const { data } = await api.post(`/candidate/interviews/${interviewId}/respond/`, note ? { action, note } : { action })
  return data
}
