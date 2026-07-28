import { canAccessAdminRoute } from '@/entities/admin-access'
import { adminPath } from '@/shared/config/portals'

function accessAllowed(access, adminAccess) {
  if (!access) return true
  if (access.superuser && !adminAccess.isSuperuser) return false
  if (access.allOf && !adminAccess.hasAll(access.allOf)) return false
  if (access.anyOf && !adminAccess.hasAny(access.anyOf)) return false
  return true
}

function queryString(query = {}) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== '' && value != null) params.set(key, String(value))
  })
  const value = params.toString()
  return value ? `?${value}` : ''
}

export function buildAdminNavigation(navigation, routes, adminAccess) {
  const routesById = new Map(routes.map((route) => [route.id, route]))

  const resolveNode = (node) => {
    if (!accessAllowed(node.access, adminAccess)) return null
    if (node.children) {
      const children = node.children.map(resolveNode).filter(Boolean)
      return children.length ? { ...node, children } : null
    }

    const route = node.routeRef ? routesById.get(node.routeRef) : null
    if (node.routeRef && !route) return null
    if (route && !canAccessAdminRoute(route, adminAccess)) return null
    if (!route && node.status === 'comingSoon' && !node.access && !adminAccess.isSuperuser) {
      return null
    }
    const path = route ? adminPath(route.segment) : null
    return {
      ...node,
      path,
      href: path ? `${path}${queryString(node.query)}` : null,
      route,
    }
  }

  return navigation.map(resolveNode).filter(Boolean)
}

export function flattenAdminNavigation(navigation) {
  const leaves = []
  navigation.forEach((levelOne) => {
    levelOne.children.forEach((levelTwo) => {
      levelTwo.children.forEach((leaf) => {
        leaves.push({
          ...leaf,
          breadcrumb: [levelOne.label, levelTwo.label, leaf.label],
          ancestors: [levelOne.key, levelTwo.key],
        })
      })
    })
  })
  return leaves
}

function queryMatches(query, searchParams) {
  return Object.entries(query || {}).every(
    ([key, value]) => searchParams.get(key) === String(value),
  )
}

export function findActiveAdminNavigation(navigation, pathname, search = '') {
  const searchParams = new URLSearchParams(search)
  const candidates = flattenAdminNavigation(navigation)
    .filter((leaf) => (
      leaf.path
      && (pathname === leaf.path || pathname.startsWith(`${leaf.path}/`))
      && queryMatches(leaf.query, searchParams)
    ))
    .sort((left, right) => {
      const queryScore = Object.keys(right.query || {}).length - Object.keys(left.query || {}).length
      return queryScore || right.path.length - left.path.length
    })
  return candidates[0] || null
}

export function searchAdminNavigation(navigation, query) {
  const normalized = query.trim().toLocaleLowerCase('vi')
  if (!normalized) return []
  return flattenAdminNavigation(navigation).filter((leaf) => (
    [...leaf.breadcrumb, leaf.description || '']
      .join(' ')
      .toLocaleLowerCase('vi')
      .includes(normalized)
  ))
}
