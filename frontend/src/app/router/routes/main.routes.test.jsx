import { describe, expect, it, vi } from 'vitest'
import { CANDIDATE_MENU, findActiveAccountItem } from '@/entities/account'
import AuthGuard from '../guards/AuthGuard'
import RoleGuard from '../guards/RoleGuard'
import { CandidateAccountLayout, FollowedCompaniesPage } from '../lazy/main.pages'
import { mainRoutes } from './main.routes'

vi.mock('../lazy/layouts', () => ({ AuthLayout: () => null, MainLayout: () => null, OnboardingLayout: () => null }))

const FOLLOWED_COMPANIES_PATH = '/tai-khoan/cong-ty-dang-theo-doi'

/** Chuỗi element bọc ngoài route có `path`, từ ngoài vào trong. */
function wrappersOf(path, routes = mainRoutes(), ancestors = []) {
  for (const route of [routes].flat(Infinity).filter(Boolean)) {
    if (route.props.path === path) return [...ancestors, route.props.element]
    const found = wrappersOf(path, route.props.children || [], [...ancestors, route.props.element])
    if (found) return found
  }
  return null
}

describe('followed companies account route', () => {
  it('sits in the job-search group of the candidate menu, inside the account layout', () => {
    const group = CANDIDATE_MENU.find((item) => item.key === 'search')

    expect(group.items).toContainEqual({
      key: 'followed-companies',
      label: 'Công ty đang theo dõi',
      path: FOLLOWED_COMPANIES_PATH,
    })
    expect(findActiveAccountItem(FOLLOWED_COMPANIES_PATH).key).toBe('followed-companies')
  })

  it('is lazy and protected by AuthGuard then RoleGuard(candidate) like its sibling account pages', () => {
    const wrappers = wrappersOf(FOLLOWED_COMPANIES_PATH)

    expect(wrappers.map((element) => element.type).slice(1)).toEqual([
      AuthGuard,
      RoleGuard,
      CandidateAccountLayout,
      FollowedCompaniesPage,
    ])
    expect(wrappers[2].props.allowedRoles).toEqual(['candidate'])
    expect(wrappers.map((element) => element.type))
      .toEqual(wrappersOf('/tai-khoan/viec-lam-da-ung-tuyen').map((element) => element.type).with(-1, FollowedCompaniesPage))
  })
})
