export function resolveActiveAdminAccountTab(tabs, requestedTab) {
  const fallback = tabs[0]?.key || 'overview'
  if (!requestedTab) return fallback
  return tabs.some((tab) => tab.key === requestedTab) ? requestedTab : fallback
}
