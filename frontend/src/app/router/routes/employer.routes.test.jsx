import { describe, expect, it, vi } from 'vitest'
import AuthGuard from '../guards/AuthGuard'
import EmployerOnboardingGuard from '../guards/EmployerOnboardingGuard'
import RoleGuard from '../guards/RoleGuard'
import { EmployerCompanyWorkspacePage } from '../lazy/employer.pages'
import { employerRoutes } from './employer.routes'

vi.mock('../lazy/layouts', () => ({
  DashboardLayout: () => null,
  EmployerAuthLayout: () => null,
  EmployerMarketingLayout: () => null,
  EmployerSetupLayout: () => null,
}))

/** Chuỗi element bọc ngoài route có `path`, từ ngoài vào trong. */
function wrappersOf(path, routes = employerRoutes(), ancestors = []) {
  for (const route of [routes].flat(Infinity).filter(Boolean)) {
    if (route.props.path === path) return [...ancestors, route.props.element]
    const found = wrappersOf(path, route.props.children || [], [...ancestors, route.props.element])
    if (found) return found
  }
  return null
}

describe('employer company page route', () => {
  it('is lazy and guarded like its sibling workspace pages, without the job-workspace gate', () => {
    const wrappers = wrappersOf('/tuyendung/app/company-page')
    const types = wrappers.map((element) => element.type)

    expect(types.slice(0, 3)).toEqual([AuthGuard, RoleGuard, EmployerOnboardingGuard])
    expect(wrappers[1].props.allowedRoles).toEqual(['employer'])
    expect(types.at(-1)).toBe(EmployerCompanyWorkspacePage)
    expect(types).toEqual(wrappersOf('/tuyendung/app/activities').map((element) => element.type).with(-1, EmployerCompanyWorkspacePage))
  })
})
