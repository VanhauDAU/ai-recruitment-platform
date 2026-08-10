import api from './client'

const POLL_INTERVAL_MS = 750
const MAX_STATUS_POLLS = 160
const cleanSessionsByFile = new WeakMap()

const CONTENT_TYPE_BY_EXTENSION = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
  png: 'image/png',
  webp: 'image/webp',
}

const UPLOAD_STATE_PRESENTATION = {
  clean: { tone: 'text-emerald-700', text: 'Tệp đã vượt qua kiểm tra an toàn.' },
  error: { tone: 'text-red-600', text: 'Không thể kiểm tra tệp. Vui lòng thử tải lại.' },
  expired: { tone: 'text-red-600', text: 'Phiên tải tệp đã hết hạn. Vui lòng tải lại.' },
  quarantined: { tone: 'text-amber-700', text: 'Tệp đang chờ kiểm tra an toàn…' },
  rejected: { tone: 'text-red-600', text: 'Tệp không vượt qua kiểm tra an toàn.' },
  scanning: { tone: 'text-amber-700', text: 'Tệp đang được kiểm tra an toàn…' },
  uploading: { tone: 'text-slate-600', text: 'Đang tải tệp vào vùng kiểm tra an toàn…' },
}

export function getUploadStatePresentation(session) {
  return session?.state ? UPLOAD_STATE_PRESENTATION[session.state] : null
}

function fileContentType(file) {
  if (file.type) return file.type
  const extension = file.name?.split('.').pop()?.toLowerCase()
  return CONTENT_TYPE_BY_EXTENSION[extension] || 'application/octet-stream'
}

function uploadSessionError(payload, fallback) {
  const data = payload && typeof payload === 'object'
    ? payload
    : { code: 'UPLOAD_INVALID_STATE', message: fallback, retryable: false }
  const error = new Error(data.message || fallback)
  error.code = data.code
  error.retryable = Boolean(data.retryable)
  error.response = { status: 409, data }
  return error
}

function wait(delay, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Upload cancelled.', 'AbortError'))
      return
    }
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Upload cancelled.', 'AbortError'))
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delay)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export async function createUploadSession(file, purpose) {
  const { data } = await api.post('/uploads/sessions/', {
    purpose,
    original_filename: file.name,
    content_type: fileContentType(file),
    size_bytes: file.size,
  })
  return data
}

export async function uploadSessionContent(publicId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post(`/uploads/sessions/${publicId}/content/`, formData)
  return data
}

export async function getUploadSession(publicId) {
  const { data } = await api.get(`/uploads/sessions/${publicId}/`)
  return data
}

export async function cancelUploadSession(publicId) {
  const { data } = await api.post(`/uploads/sessions/${publicId}/cancel/`)
  return data
}

export async function retryUploadSession(publicId) {
  const { data } = await api.post(`/uploads/sessions/${publicId}/retry/`)
  return data
}

export async function prepareCleanUpload(file, purpose, options = {}) {
  const { onStateChange, signal } = options
  const cached = cleanSessionsByFile.get(file)
  if (cached?.purpose === purpose) {
    const current = await getUploadSession(cached.publicId)
    onStateChange?.(current)
    if (current.ready_for_submit) return current
    cleanSessionsByFile.delete(file)
  }

  let session = await createUploadSession(file, purpose)
  onStateChange?.(session)
  session = await uploadSessionContent(session.public_id, file)
  onStateChange?.(session)
  let retryRequested = false
  let retryWaitPolls = 0

  for (let poll = 0; poll < MAX_STATUS_POLLS; poll += 1) {
    if (session.ready_for_submit) {
      cleanSessionsByFile.set(file, { publicId: session.public_id, purpose })
      return session
    }
    if (['rejected', 'expired'].includes(session.state)) {
      throw uploadSessionError(session, 'Tệp không vượt qua kiểm tra an toàn.')
    }
    if (session.state === 'error') {
      if (session.retryable && !retryRequested) {
        retryRequested = true
        session = await retryUploadSession(session.public_id)
        onStateChange?.(session)
        await wait(POLL_INTERVAL_MS, signal)
        session = await getUploadSession(session.public_id)
        onStateChange?.(session)
        continue
      }
      if (retryRequested && retryWaitPolls < 10) {
        retryWaitPolls += 1
        await wait(POLL_INTERVAL_MS, signal)
        session = await getUploadSession(session.public_id)
        onStateChange?.(session)
        continue
      }
      throw uploadSessionError(session, 'Không thể xác nhận tệp an toàn.')
    }
    await wait(POLL_INTERVAL_MS, signal)
    session = await getUploadSession(session.public_id)
    onStateChange?.(session)
  }

  throw uploadSessionError(
    {
      code: 'UPLOAD_SCAN_TIMEOUT',
      message: 'Quá thời gian chờ kiểm tra tệp. Vui lòng thử lại.',
      retryable: true,
    },
    'Quá thời gian chờ kiểm tra tệp.',
  )
}
