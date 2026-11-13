export function foldKnowledgeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi-VN')
}

export function knowledgeMatchRanges(text, query) {
  const source = String(text || '')
  const needle = foldKnowledgeText(String(query || '').trim())
  if (!source || !needle) return []

  const folded = foldKnowledgeText(source)
  const ranges = []
  let cursor = 0
  while (cursor < folded.length) {
    const start = folded.indexOf(needle, cursor)
    if (start < 0) break
    ranges.push([start, start + needle.length])
    cursor = start + needle.length
  }
  return ranges
}
