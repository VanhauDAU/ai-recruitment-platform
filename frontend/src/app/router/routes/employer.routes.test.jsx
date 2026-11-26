import { describe, expect, it, vi } from 'vitest'
import AuthGuard from '../guards/AuthGuard'
import EmployerOnboardingGuard from '../guards/EmployerOnboardingGuard'
import RoleGuard from '../guards/RoleGuard'
import CandidateDataGuard from '../guards/CandidateDataGuard'
import { EmployerCompanyWorkspacePage, EmployerConnectPage } from '../lazy/employer.pages.js'
import { employerRoutes } from './employer.routes'

vi.mock('../lazy/layouts.js', () => ({
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
    const wrappers = wrappersOf('/tuyendung/app/trang-cong-ty')
    const types = wrappers.map((element) => element.type)

    expect(types.slice(0, 3)).toEqual([AuthGuard, RoleGuard, EmployerOnboardingGuard])
    expect(wrappers[1].props.allowedRoles).toEqual(['employer'])
    expect(types.at(-1)).toBe(EmployerCompanyWorkspacePage)
    expect(types).toEqual(wrappersOf('/tuyendung/app/lich-su-hoat-dong').map((element) => element.type).with(-1, EmployerCompanyWorkspacePage))
  })
})

describe('employer ProCV Connect routes', () => {
  it('sit with the other candidate-data pages of the workspace', () => {
    for (const path of ['/tuyendung/app/procv-connect', '/tuyendung/app/procv-connect/:conversationId']) {
      const types = wrappersOf(path).map((element) => element.type)
      expect(types.slice(0, 3)).toEqual([AuthGuard, RoleGuard, EmployerOnboardingGuard])
      expect(types).toContain(CandidateDataGuard)
      expect(types).toEqual(wrappersOf('/tuyendung/app/ho-so-ung-tuyen').map((element) => element.type).with(-1, EmployerConnectPage))
    }
  })
})
