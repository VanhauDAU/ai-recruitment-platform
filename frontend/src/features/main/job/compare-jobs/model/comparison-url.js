import { MAX_COMPARISON_JOBS } from './comparison-state'

// Match Django's <slug:slug> path converter. Production job slugs include the
// public id suffix (for example `frontend-engineer-job_ab12`), so `_` must be
// preserved when the comparison link is built.
const SAFE_SLUG = /^[-a-zA-Z0-9_]{1,255}$/

export function parseComparisonSlugs(value) {
  const params = value instanceof URLSearchParams
    ? value
    : new URLSearchParams(String(value || '').replace(/^\?/, ''))
  const seen = new Set()
  const slugs = []
  for (const raw of params.getAll('job')) {
    const slug = raw.trim()
    if (!SAFE_SLUG.test(slug) || seen.has(slug)) continue
    seen.add(slug)
    slugs.push(slug)
    if (slugs.length === MAX_COMPARISON_JOBS) break
  }
  return slugs
}

export function comparisonSearchParams(itemsOrSlugs = []) {
  const params = new URLSearchParams()
  const seen = new Set()
  for (const value of itemsOrSlugs) {
    const slug = String(typeof value === 'string' ? value : value?.slug || '').trim()
    if (!SAFE_SLUG.test(slug) || seen.has(slug)) continue
    seen.add(slug)
    params.append('job', slug)
    if (seen.size === MAX_COMPARISON_JOBS) break
  }
  return params
}

export function buildJobComparisonPath(itemsOrSlugs = []) {
  const query = comparisonSearchParams(itemsOrSlugs).toString()
  return query ? `/so-sanh-viec-lam?${query}` : '/so-sanh-viec-lam'
}
