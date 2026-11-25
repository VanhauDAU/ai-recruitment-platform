import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withQueryClient } from '@/test/render-with-query-client'
import NearbyJobs from './NearbyJobs'

const mocks = vi.hoisted(() => ({
  getNearbyJobs: vi.fn(),
  getNearbyJobMap: vi.fn(),
  getGeoWard: vi.fn(),
  settings: {},
}))

vi.mock('@/entities/job/job', async (importOriginal) => ({
  ...(await importOriginal()),
  getNearbyJobs: mocks.getNearbyJobs,
  getNearbyJobMap: mocks.getNearbyJobMap,
  getJobCategories: async () => [],
}))

vi.mock('@/entities/system/location', async (importOriginal) => ({
  ...(await importOriginal()),
  getGeoWard: mocks.getGeoWard,
  searchGeoPlaces: async () => [],
}))

vi.mock('@/entities/system/site-settings', () => ({
  useSiteSettings: () => ({ settings: mocks.settings }),
  useSiteSetting: () => '',
}))

vi.mock('@/shared/ui/map/MapView', () => ({
  default: ({ points, onPointClick }) => (
    <div data-testid="map">
      {points.map((point) => (
        <button key={point.key} type="button" onClick={() => onPointClick(point)}>{`pin ${point.label}`}</button>
      ))}
    </div>
  ),
}))

const ORIGIN = {
  latitude: 16.0, longitude: 108.2, radius_km: 10,
  ward: { id: 1, name: 'Phường Điện Bàn', slug: 'p-dien-ban', province_id: 9, province_name: 'Thành phố Đà Nẵng' },
}

function job(slug, overrides = {}) {
  return {
    public_id: slug,
    slug,
    title: `Việc ${slug}`,
    company_name: 'Cơ sở Thành Đạt',
    salary_type: 'negotiable',
    distance_km: 3.44,
    match_kind: 'distance',
    nearby_workplace_count: 1,
    deadline: '2026-12-17',
    nearest_workplace: { display: 'Số 1, Phường Điện Bàn, Thành phố Đà Nẵng', precision: 'exact' },
    ...overrides,
  }
}

function LocationProbe() {
  return <output data-testid="search">{useLocation().search}</output>
}

function renderPage(path = '/viec-lam-gan-ban?gan=p-dien-ban') {
  return render(withQueryClient(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/viec-lam-gan-ban" element={<><NearbyJobs /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  ))
}

describe('NearbyJobs page', () => {
  beforeEach(() => {
    sessionStorage.clear()
    Element.prototype.scrollIntoView = vi.fn() // jsdom không có
    mocks.settings = {}
    mocks.getGeoWard.mockResolvedValue({ ward_name: 'Phường Điện Bàn', latitude: 16.0, longitude: 108.2 })
    mocks.getNearbyJobMap.mockResolvedValue({ origin: ORIGIN, points: [], truncated: false })
    mocks.getNearbyJobs.mockResolvedValue({ count: 0, results: [], origin: ORIGIN, expand_suggestion: null })
  })

  it('asks for a location before searching', async () => {
    renderPage('/viec-lam-gan-ban')
    expect(await screen.findByText('Chọn vị trí để xem việc làm quanh bạn')).toBeInTheDocument()
    expect(mocks.getNearbyJobs).not.toHaveBeenCalled()
  })

  it('lists jobs by distance around the ward from the URL, grouping province-wide ones', async () => {
    mocks.getNearbyJobs.mockResolvedValue({
      count: 2,
      origin: ORIGIN,
      expand_suggestion: null,
      results: [job('a', { presentation: { labels: [{ code: 'closing_soon', text: 'Sắp hết hạn', tone: 'warning' }] } }), job('b', { match_kind: 'province_wide', distance_km: null })],
    })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Việc làm gần tôi tại Đà Nẵng' })).toBeInTheDocument()
    expect(screen.getByText('3,4 km')).toBeInTheDocument()
    expect(screen.getByText('Sắp hết hạn')).toBeInTheDocument()
    expect(screen.getByText('Tuyển khắp Đà Nẵng')).toBeInTheDocument()
    expect(screen.getByText('Khắp tỉnh')).toBeInTheDocument()
    expect(screen.getAllByText('Phường Điện Bàn, Thành phố Đà Nẵng')).toHaveLength(2)
    const params = mocks.getNearbyJobs.mock.calls[0][0]
    expect(Object.fromEntries(params)).toEqual({ lat: '16', lng: '108.2', radius_km: '10' })
  })

  it('offers the next radius when nothing is close and applies it', async () => {
    mocks.getNearbyJobs.mockResolvedValue({ count: 0, results: [], origin: ORIGIN, expand_suggestion: { radius_km: 20, count: 4 } })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Mở rộng 20 km (4 việc)' }))
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('r=20'))
  })

  it('highlights the cards of a clicked map pin', async () => {
    mocks.getNearbyJobs.mockResolvedValue({ count: 1, results: [job('a')], origin: ORIGIN, expand_suggestion: null })
    mocks.getNearbyJobMap.mockResolvedValue({
      origin: ORIGIN,
      truncated: false,
      points: [{ latitude: 16, longitude: 108.2, label: 'Phường Điện Bàn', precision: 'exact', distance_km: 3.4, jobs: [{ slug: 'a', title: 'Việc a' }] }],
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'pin P. Điện Bàn' }))
    expect(screen.getByText('1 việc tại P. Điện Bàn')).toBeInTheDocument()
    expect(document.querySelector('[data-job-slug="a"]')).toHaveClass('nearby-card--active')
  })

  it('shows a clear message when location access is denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (_, fail) => fail({ code: 1 }) },
    })
    renderPage('/viec-lam-gan-ban')
    await userEvent.click(screen.getByRole('button', { name: /Dùng vị trí của tôi/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn đã chặn quyền vị trí')
  })

  it('respects the admin switch', async () => {
    mocks.settings = { nearby_jobs_enabled: false }
    renderPage()
    expect(await screen.findByText('Tính năng Việc làm gần tôi đang tạm tắt.')).toBeInTheDocument()
  })
})
