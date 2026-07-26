export function setDocumentMetaDescription(value) {
  if (typeof document === 'undefined') return () => {}
  let element = document.head.querySelector('meta[name="description"]')
  const previous = element?.getAttribute('content') || ''
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute('name', 'description')
    document.head.appendChild(element)
  }
  element.setAttribute('content', String(value || '').trim())
  return () => element.setAttribute('content', previous)
}
