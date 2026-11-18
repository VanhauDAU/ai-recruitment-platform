function normalizedWords(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export function tagFingerprint(tag) {
  const ignored = new Set(['nghe', 'tag', 'the'])
  const aliases = { sale: 'sales' }
  return normalizedWords(tag.name)
    .filter((word) => !ignored.has(word))
    .map((word) => aliases[word] || word)
    .sort()
    .join('-')
}

export function findSimilarTagGroups(tags) {
  const groups = new Map()
  tags.forEach((tag) => {
    const fingerprint = tagFingerprint(tag)
    if (!fingerprint) return
    groups.set(fingerprint, [...(groups.get(fingerprint) || []), tag])
  })
  return [...groups.values()].filter((group) => group.length > 1)
}
