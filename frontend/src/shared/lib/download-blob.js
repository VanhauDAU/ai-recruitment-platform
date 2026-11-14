/** Save an in-memory file (already authorized and fetched) through the browser. */
export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Some browsers start reading the blob after click() returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
