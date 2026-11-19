import { canAccessAdminRoute } from '@/entities/account/admin-access'
import { adminPath } from '@/shared/config/portals'

function accessAllowed(access, adminAccess) {
  return !access?.superuser || adminAccess.isSuperuser
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

    const route = routesById.get(node.routeRef)
    if (!route || !canAccessAdminRoute(route, adminAccess)) return null
    const path = adminPath(route.segment)
    return {
      ...node,
      path,
      matchPath: node.matchSegment ? adminPath(node.matchSegment) : path,
      href: `${path}${queryString(node.query)}`,
      route,
    }
  }

  return navigation.map(resolveNode).filter(Boolean)
}

export function flattenAdminNavigation(navigation) {
  const leaves = []

  const visit = (nodes, breadcrumb = [], ancestors = []) => {
    nodes.forEach((node) => {
      if (node.children?.length) {
        visit(
          node.children,
          [...breadcrumb, node.label],
          [...ancestors, node.key],
        )
        return
      }
      leaves.push({
        ...node,
        breadcrumb: [...breadcrumb, node.label],
        ancestors,
      })
    })
  }

  visit(navigation)
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
      leaf.matchPath
      && (pathname === leaf.matchPath || pathname.startsWith(`${leaf.matchPath}/`))
      && queryMatches(leaf.query, searchParams)
    ))
    .sort((left, right) => {
      const queryScore = Object.keys(right.query || {}).length - Object.keys(left.query || {}).length
      return queryScore || right.matchPath.length - left.matchPath.length
    })
  return candidates[0] || null
}

const foldText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .trim()

/**
 * Quick-jump results: every query word must appear in the destination's
 * breadcrumb, accents ignored. Destinations whose label starts with the query
 * rank first, then those whose label contains it; ties keep navigation order.
 */
export function searchAdminDestinations(destinations, query) {
  const words = foldText(query).split(/\s+/).filter(Boolean)
  if (!words.length) return destinations
  const phrase = words.join(' ')
  return destinations
    .map((destination, order) => {
      const label = foldText(destination.label)
      const haystack = foldText(destination.breadcrumb.join(' '))
      if (!words.every((word) => haystack.includes(word))) return null
      const rank = label.startsWith(phrase) ? 0 : label.includes(phrase) ? 1 : 2
      return { destination, rank, order }
    })
    .filter(Boolean)
    .sort((left, right) => left.rank - right.rank || left.order - right.order)
    .map(({ destination }) => destination)
}
