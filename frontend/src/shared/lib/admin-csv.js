const FORMULA_PREFIX = /^[\t\r\n =+\-@]/

function normalizeCsvValue(value) {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (Array.isArray(value)) return value.join(' | ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function escapeCsvCell(value) {
  let normalized = normalizeCsvValue(value)
  if (typeof value === 'string' && FORMULA_PREFIX.test(normalized)) {
    normalized = `'${normalized}`
  }
  return `"${normalized.replaceAll('"', '""')}"`
}

export function serializeCsv(rows, columns) {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(',')
  const body = rows.map((row) => columns.map((column) => {
    const value = typeof column.value === 'function'
      ? column.value(row)
      : row[column.key]
    return escapeCsvCell(value)
  }).join(','))
  return `\uFEFF${[header, ...body].join('\r\n')}`
}

function safeFilename(filename) {
  const normalized = String(filename || 'du-lieu')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'du-lieu'
}

export function downloadCsv({ rows, columns, filename }) {
  if (!rows?.length || !columns?.length) return false

  const blob = new Blob([serializeCsv(rows, columns)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeFilename(filename)}.csv`
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return true
}
