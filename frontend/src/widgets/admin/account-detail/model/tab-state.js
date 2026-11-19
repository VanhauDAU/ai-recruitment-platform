// Old deep links that now land on a merged tab (the employer "Hồ sơ NTD" tab
// moved into "Tổng quan"). Only used when the role has no tab of that name.
const TAB_ALIASES = { profile: 'overview' }

export function resolveActiveAdminAccountTab(tabs, requestedTab) {
  const fallback = tabs[0]?.key || 'overview'
  if (!requestedTab) return fallback
  const has = (key) => tabs.some((tab) => tab.key === key)
  if (has(requestedTab)) return requestedTab
  return has(TAB_ALIASES[requestedTab]) ? TAB_ALIASES[requestedTab] : fallback
}
