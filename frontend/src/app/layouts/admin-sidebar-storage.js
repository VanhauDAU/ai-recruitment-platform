// Sidebar layout choices are per-viewer conveniences: blocked or empty storage
// only means the sidebar starts from its defaults.
export const SIDEBAR_COLLAPSED_KEY = 'procv_admin_sidebar_collapsed'
export const SIDEBAR_OPEN_GROUPS_KEY = 'procv_admin_nav_open'

export function readSidebarPreference(key, fallback) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key))
    return value ?? fallback
  } catch {
    return fallback
  }
}

export function saveSidebarPreference(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable: the choice lasts for this page view only.
  }
}
