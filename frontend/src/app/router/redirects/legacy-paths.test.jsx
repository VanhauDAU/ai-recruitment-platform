import { render, screen } from '@testing-library/react'
import { createRoutesFromElements, generatePath, matchRoutes, MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { adminRoutes, employerRoutes, mainRoutes } from '../routes'
import LegacyPathFallback from './LegacyPathFallback'
import { LEGACY_ADMIN_PATHS, LEGACY_EMPLOYER_PATHS, LEGACY_MAIN_PATHS, resolveLegacyPath } from './legacy-paths'

vi.mock('../lazy/layouts.js', () => ({
  AuthLayout: () => null,
  DashboardLayout: () => null,
  EmployerAuthLayout: () => null,
  EmployerMarketingLayout: () => null,
  EmployerSetupLayout: () => null,
  MainLayout: () => null,
  OnboardingLayout: () => null,
}))
vi.mock('@/pages/common/not-found/NotFound', () => ({ default: () => <p>404</p> }))

const PORTALS = [
  ['main', LEGACY_MAIN_PATHS, mainRoutes],
  ['employer', LEGACY_EMPLOYER_PATHS, employerRoutes],
  ['admin', LEGACY_ADMIN_PATHS, adminRoutes],
]

/** Điền mọi `:param` bằng giá trị mẫu để thử khớp route. */
const sample = (pattern) => generatePath(pattern, new Proxy({}, { get: () => 'x_1' }))

describe.each(PORTALS)('legacy paths of the %s portal', (_portal, pairs, buildRoutes) => {
  const routes = createRoutesFromElements(buildRoutes())
  const leaf = (path) => matchRoutes(routes, path)?.at(-1)?.route.path ?? null

  it('point to a route that exists', () => {
    expect(pairs.filter(([, to]) => leaf(sample(to)) !== to)).toEqual([])
  })

  it('match no current route, so they fall through to the legacy redirect', () => {
    expect(pairs.filter(([from]) => leaf(sample(from)) !== null)).toEqual([])
  })

  it('resolve to their own target (static paths win over dynamic ones)', () => {
    expect(pairs.filter(([from, to]) => resolveLegacyPath(sample(from), pairs) !== sample(to))).toEqual([])
  })

  it('use only Vietnamese segments on the new side', () => {
    const english = /\/(login|register|sign-up|account|settings|dashboard|jobs|campaigns|edit|setup|new|view|share)(\/|$)/
    expect(pairs.map(([, to]) => to).filter((to) => english.test(to))).toEqual([])
  })
})

function CurrentUrl() {
  const { pathname, search, hash } = useLocation()
  return <p>{`${pathname}${search}${hash}`}</p>
}

function renderAt(url) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/tuyendung/app/tin-tuyen-dung/:publicId/chinh-sua" element={<CurrentUrl />} />
        <Route path="*" element={<LegacyPathFallback />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LegacyPathFallback', () => {
  it('redirects an old URL keeping route params, query and hash', () => {
    renderAt('/tuyendung/app/jobs/jb_1/edit?tab=info#salary')

    expect(screen.getByText('/tuyendung/app/tin-tuyen-dung/jb_1/chinh-sua?tab=info#salary')).toBeInTheDocument()
  })

  it('shows the 404 page for an unknown URL', () => {
    renderAt('/khong-ton-tai')

    expect(screen.getByText('404')).toBeInTheDocument()
  })
})
