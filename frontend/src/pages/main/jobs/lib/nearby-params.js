import { SALARY_RANGES } from '@/entities/job/job'
import { roundCoordinate } from '@/shared/lib/geo'

// Khớp RADIUS_OPTIONS_KM của backend (apps/jobs/selectors/nearby.py).
export const RADIUS_OPTIONS = [3, 5, 10, 20, 50]

export function radiusOptions(maxKm) {
  const options = RADIUS_OPTIONS.filter((km) => km <= maxKm)
  return options.length ? options : [RADIUS_OPTIONS[0]]
}

function positiveInt(value, fallback) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

// URL chỉ giữ thứ chia sẻ được: bán kính, bộ lọc, trang và phường/xã gốc (`gan`).
// Tọa độ GPS không bao giờ lên URL (xem lib/nearby-origin của entity location).
export function readNearbyFilters(searchParams, { defaultRadius, maxRadius }) {
  const radius = positiveInt(searchParams.get('r'), defaultRadius)
  return {
    radius: radiusOptions(maxRadius).includes(radius) ? radius : defaultRadius,
    category: searchParams.get('cat') || '',
    salary: searchParams.get('salary') || '',
    remote: searchParams.get('remote') === '1',
    page: positiveInt(searchParams.get('page'), 1),
    wardSlug: searchParams.get('gan') || '',
  }
}

export function nearbyApiParams(origin, filters) {
  const params = new URLSearchParams({
    lat: String(roundCoordinate(origin.latitude)),
    lng: String(roundCoordinate(origin.longitude)),
    radius_km: String(filters.radius),
  })
  if (filters.category) params.set('category', filters.category)
  if (filters.salary === 'nego') params.set('salary_negotiable', '1')
  const range = SALARY_RANGES.find((item) => item.key === filters.salary)
  if (range?.gte) params.set('salary_gte', String(range.gte))
  if (range?.lte) params.set('salary_lte', String(range.lte))
  if (filters.remote) params.set('include_remote', '1')
  if (filters.page > 1) params.set('page', String(filters.page))
  return params
}

// Nhãn gọn trên ghim/thẻ: "Phường Điện Bàn" -> "P. Điện Bàn", "Thành phố Đà Nẵng" -> "Đà Nẵng".
// Tên đơn vị hành chính là dữ liệu tiếng Việt ở mọi ngôn ngữ giao diện.
const SHORT_PREFIXES = { 'Phường ': 'P. ', 'Xã ': 'X. ', 'Đặc khu ': 'ĐK. ', 'Thành phố ': '', 'Tỉnh ': '' }

export function shortPlaceName(name = '') {
  const prefix = Object.keys(SHORT_PREFIXES).find((item) => name.startsWith(item))
  return prefix === undefined ? name : SHORT_PREFIXES[prefix] + name.slice(prefix.length)
}
