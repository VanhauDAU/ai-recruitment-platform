const GENERIC_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
])

const MIME_ALIASES = {
  'application/x-pdf': 'application/pdf',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
}

const MIME_BY_EXTENSION = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  csv: 'text/csv',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jfif: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  json: 'application/json',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  txt: 'text/plain',
  webp: 'image/webp',
  xml: 'application/xml',
}

export function normalizeDocumentMimeType(value) {
  const normalized = String(value || '').split(';', 1)[0].trim().toLowerCase()
  return MIME_ALIASES[normalized] || normalized
}

function mimeTypeFromFileName(fileName) {
  const cleanName = String(fileName || '').split(/[?#]/, 1)[0]
  const extension = cleanName.includes('.') ? cleanName.split('.').pop().toLowerCase() : ''
  return MIME_BY_EXTENSION[extension] || ''
}

export function resolveDocumentMimeType({
  responseMimeType,
  storedMimeType,
  fileName,
}) {
  const responseType = normalizeDocumentMimeType(responseMimeType)
  if (!GENERIC_MIME_TYPES.has(responseType)) return responseType

  const storedType = normalizeDocumentMimeType(storedMimeType)
  if (!GENERIC_MIME_TYPES.has(storedType)) return storedType

  return mimeTypeFromFileName(fileName) || 'application/octet-stream'
}

export function documentPreviewKind(mimeType) {
  const normalized = normalizeDocumentMimeType(mimeType)
  if (normalized === 'application/pdf') return 'pdf'
  if (normalized.startsWith('image/')) return 'image'
  if (
    normalized.startsWith('text/')
    || normalized === 'application/json'
    || normalized === 'application/xml'
  ) {
    return 'text'
  }
  return 'download'
}
