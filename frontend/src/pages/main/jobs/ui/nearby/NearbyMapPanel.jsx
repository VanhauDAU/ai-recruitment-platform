import { lazy, Suspense, useMemo } from 'react'
import { useBasemap } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'
import { shortPlaceName } from '../../lib/nearby-params'

const MapView = lazy(() => import('@/shared/ui/map/MapView'))

export default function NearbyMapPanel({
  origin,
  radius,
  points,
  truncated,
  activeSlugs,
  onOriginChange,
  onPointClick,
}) {
  const basemap = useBasemap()
  const markers = useMemo(() => points.map((point) => ({
    ...point,
    key: `${point.latitude},${point.longitude}`,
    count: point.jobs.length,
    label: shortPlaceName(point.label),
    title: point.jobs.map((job) => job.title).join(', '),
    active: point.jobs.some((job) => activeSlugs.has(job.slug)),
  })), [points, activeSlugs])

  if (!basemap) return null
  return (
    <div className="nearby-map">
      <div className="nearby-map__canvas" role="region" aria-label={m.candidate_nearby_map_label()}>
        <Suspense fallback={<div className="map-view nearby-map__placeholder" />}>
          <MapView
            key={basemap.styleUrl}
            styleUrl={basemap.styleUrl}
            attribution={basemap.attribution}
            origin={origin}
            radiusKm={origin ? radius : null}
            originLabel={origin?.label}
            points={markers}
            onOriginChange={onOriginChange}
            onPointClick={onPointClick}
          />
        </Suspense>
      </div>
      <p className="nearby-map__note">
        {m.candidate_nearby_map_note()}
        {' '}
        {truncated ? m.candidate_nearby_map_truncated({ count: points.length }) : m.candidate_nearby_map_hint()}
      </p>
    </div>
  )
}
