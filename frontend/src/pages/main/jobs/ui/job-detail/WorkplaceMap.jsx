import { lazy, Suspense, useMemo } from 'react'
import { useBasemap } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'
import { shortPlaceName } from '../../lib/nearby-params'

const MapView = lazy(() => import('@/shared/ui/map/MapView'))

// Bản đồ nhỏ các nơi làm việc có tọa độ; ghim xanh là vị trí ứng viên đã chọn ở
// "Việc làm gần tôi" trong phiên này (nếu có).
export default function WorkplaceMap({ addresses, origin }) {
  const basemap = useBasemap()
  const points = useMemo(() => addresses
    .filter((address) => Number.isFinite(address.latitude))
    .map((address) => ({
      latitude: address.latitude,
      longitude: address.longitude,
      label: shortPlaceName(address.ward_name || ''),
      title: address.display,
    })), [addresses])
  if (!basemap || !points.length) return null
  return (
    <div className="job-workplace-map" role="region" aria-label={m.candidate_nearby_map_label()}>
      <Suspense fallback={<div className="map-view" />}>
        <MapView key={basemap.id} mapStyle={basemap.style} attribution={basemap.attribution} origin={origin} points={points} fitPoints />
      </Suspense>
    </div>
  )
}
