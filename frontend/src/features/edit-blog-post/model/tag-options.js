const SPECIAL_WORDS = {
  sales: 'Sales',
  cv: 'CV',
  seo: 'SEO',
  it: 'IT',
  hr: 'HR',
}

const SEARCH_ALIASES = {
  sales: ['kinh doanh', 'bán hàng'],
  'kinh doanh': ['sales', 'bán hàng'],
}

function searchable(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .trim()
}

export function normalizeTagName(value) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const normalized = words.map((word) => SPECIAL_WORDS[word.toLowerCase()] || word)
  normalized[0] = normalized[0][0].toLocaleUpperCase('vi-VN') + normalized[0].slice(1)
  return normalized.join(' ')
}

export function findMatchingTags(tags, query) {
  const needle = searchable(query)
  if (!needle) return tags
  const queryParts = needle.split(/\s+/).filter((part) => part.length > 2)
  const terms = [
    needle,
    ...queryParts,
    ...queryParts.flatMap((part) => SEARCH_ALIASES[part] || []),
    ...(SEARCH_ALIASES[needle] || []),
  ].map(searchable)
  return tags.filter((tag) => {
    const haystack = searchable(`${tag.name} ${tag.slug}`)
    return terms.some((term) => haystack.includes(term))
  })
}

export function hasExactTag(tags, query) {
  const needle = searchable(query)
  return tags.some((tag) => searchable(tag.name) === needle || searchable(tag.slug) === needle)
}
