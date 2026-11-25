// Hình học nhỏ cho bản đồ/khoảng cách phía trình duyệt (ADR-0029). Máy chủ là
// nguồn khoảng cách thật; đây chỉ để vẽ vòng bán kính và nhãn "Cách bạn".
const EARTH_RADIUS_KM = 6371.0088
const VN_BOUNDS = { south: 7, west: 102, north: 23.5, east: 117.9 }
export const VIETNAM_CENTER = { latitude: 16.05, longitude: 106.2 }

const toRad = (deg) => (deg * Math.PI) / 180
const toDeg = (rad) => (rad * 180) / Math.PI

export function isInVietnam(latitude, longitude) {
  return latitude >= VN_BOUNDS.south && latitude <= VN_BOUNDS.north
    && longitude >= VN_BOUNDS.west && longitude <= VN_BOUNDS.east
}

// ~110 m: đủ cho tìm việc, không gửi vị trí chính xác của người dùng đi đâu cả.
export function roundCoordinate(value, decimals = 3) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function haversineKm(a, b) {
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

// "850 m" dưới 1 km, "3,4 km" từ 1 km (dấu thập phân theo locale).
export function formatDistance(km, locale = 'vi-VN') {
  if (!Number.isFinite(km)) return ''
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`
  const digits = km < 10 ? 1 : 0
  return `${km.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits })} km`
}

// Đa giác xấp xỉ vòng tròn bán kính `radiusKm` (GeoJSON [lng, lat]).
export function circlePolygon({ latitude, longitude }, radiusKm, steps = 72) {
  const angular = radiusKm / EARTH_RADIUS_KM
  const lat = toRad(latitude)
  const lng = toRad(longitude)
  const ring = []
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (2 * Math.PI * i) / steps
    const pLat = Math.asin(Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing))
    const pLng = lng + Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
      Math.cos(angular) - Math.sin(lat) * Math.sin(pLat),
    )
    ring.push([toDeg(pLng), toDeg(pLat)])
  }
  return ring
}

export function circleBounds({ latitude, longitude }, radiusKm) {
  const dLat = toDeg(radiusKm / EARTH_RADIUS_KM)
  const dLng = toDeg(radiusKm / (EARTH_RADIUS_KM * Math.max(Math.cos(toRad(latitude)), 1e-6)))
  return [[longitude - dLng, latitude - dLat], [longitude + dLng, latitude + dLat]]
}
