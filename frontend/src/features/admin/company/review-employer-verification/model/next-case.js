/** The oldest actionable case other than the current one (oldest first = SLA order). */
export function pickNextCase(page, currentCaseId) {
  const rows = page?.results || []
  const next = rows.find((row) => row.public_id !== currentCaseId) || null
  const remaining = Math.max(0, (page?.count || 0) - (rows.some((row) => row.public_id === currentCaseId) ? 1 : 0))
  return { next, remaining }
}
