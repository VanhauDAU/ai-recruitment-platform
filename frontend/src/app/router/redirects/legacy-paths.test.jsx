import { render, screen } from '@testing-library/react'
import { createRoutesFromElements, generatePath, matchRoutes, MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('old /admin/app base of the admin portal', () => {
  it('moves to /quan-tri, translating old English segments in the same step', () => {
    expect(resolveLegacyPath('/admin/app')).toBe('/quan-tri')
    expect(resolveLegacyPath('/admin/app/dang-nhap')).toBe('/quan-tri/dang-nhap')
    expect(resolveLegacyPath('/admin/app/accounts/usr_1')).toBe('/quan-tri/tai-khoan/usr_1')
    expect(resolveLegacyPath('/admin/login')).toBe('/quan-tri/dang-nhap')
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
        <Route path="/quan-tri/loi-moi" element={<CurrentUrl />} />
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

  it('keeps the token of an old admin invitation link', () => {
    renderAt('/admin/app/loi-moi?token=signed')

    expect(screen.getByText('/quan-tri/loi-moi?token=signed')).toBeInTheDocument()
  })

  it('shows the 404 page for an unknown URL', () => {
    renderAt('/khong-ton-tai')

    expect(screen.getByText('404')).toBeInTheDocument()
  })
})

describe('portals on their own subdomains', () => {
  async function load(env) {
    vi.resetModules()
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
    return import('./legacy-paths')
  }

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('sends old main-domain portal URLs to the subdomains', async () => {
    const { resolveLegacyPath: resolve } = await load({
      VITE_EMPLOYER_HOST: 'tuyendung.example.test',
      VITE_ADMIN_HOST: 'quantri.example.test',
    })

    expect(resolve('/tuyendung/app/tin-tuyen-dung')).toBe('https://tuyendung.example.test/app/tin-tuyen-dung')
    expect(resolve('/tuyendung')).toBe('https://tuyendung.example.test')
    expect(resolve('/quan-tri/tai-khoan')).toBe('https://quantri.example.test/tai-khoan')
    expect(resolve('/admin/app/loi-moi')).toBe('https://quantri.example.test/loi-moi')
  })

  it('drops the shared prefix and sends main-site pages back on the employer host', async () => {
    const { resolveLegacyPath: resolve } = await load({
      VITE_EMPLOYER_HOST: window.location.hostname,
      VITE_ADMIN_HOST: 'quantri.example.test',
      VITE_MAIN_HOST: 'main.example.test',
    })

    expect(resolve('/tuyendung/app/jobs/jb_1/edit')).toBe('/app/tin-tuyen-dung/jb_1/chinh-sua')
    expect(resolve('/tuyendung/dich-vu')).toBe('/dich-vu')
    expect(resolve('/viec-lam/ky-su-backend')).toBe('https://main.example.test/viec-lam/ky-su-backend')
    expect(resolve('/khong-ton-tai')).toBeNull()
  })
})
