import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Segmented } from 'antd'
import { buildCategoryTree, getJobCategories, jobKeys } from '@/entities/job/job'
import { resolveGeoPlace } from '@/entities/system/location'
import { useBasemap, useSiteSettings } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'
import { isInVietnam } from '@/shared/lib/geo'
import { mergeSearchParams } from './lib/job-list-params'
import { radiusOptions, readNearbyFilters, shortPlaceName } from './lib/nearby-params'
import useCurrentPosition from './model/use-current-position'
import useNearbyOrigin from './model/use-nearby-origin'
import useNearbySearch from './model/use-nearby-search'
import NearbyFilterBar from './ui/nearby/NearbyFilterBar'
import NearbyMapPanel from './ui/nearby/NearbyMapPanel'
import NearbyResults, { NearbyPickPrompt } from './ui/nearby/NearbyResults'
import './ui/nearby/nearby-jobs.css'

const EMPTY_SET = new Set()

function numberSetting(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export default function NearbyJobs() {
  const { settings } = useSiteSettings()
  const enabled = settings.nearby_jobs_enabled !== false
  const maxRadius = numberSetting(settings.nearby_jobs_max_radius_km, 50)
  const defaultRadius = Math.min(numberSetting(settings.nearby_jobs_default_radius_km, 10), maxRadius)
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(
    () => readNearbyFilters(searchParams, { defaultRadius, maxRadius }),
    [searchParams, defaultRadius, maxRadius],
  )
  const { origin, setOrigin } = useNearbyOrigin(filters.wardSlug)
  const position = useCurrentPosition()
  const [placeError, setPlaceError] = useState(false)
  const [hoveredSlug, setHoveredSlug] = useState(null)
  const [selectedPoint, setSelectedPoint] = useState(null)
  // Điện thoại/tablet: xem danh sách hoặc bản đồ, không xếp chồng cả hai.
  const [view, setView] = useState('list')
  const hasMap = Boolean(useBasemap())
  const search = useNearbySearch(origin, filters, { enabled })
  const categoriesQuery = useQuery({
    queryKey: jobKeys.categories,
    queryFn: () => getJobCategories(),
    staleTime: 5 * 60_000,
  })
  const categoryGroups = useMemo(() => buildCategoryTree(categoriesQuery.data || []).groups, [categoriesQuery.data])

  const highlightedSlugs = useMemo(() => {
    if (selectedPoint) return new Set(selectedPoint.jobs.map((job) => job.slug))
    return hoveredSlug ? new Set([hoveredSlug]) : EMPTY_SET
  }, [selectedPoint, hoveredSlug])

  const provinceName = search.originInfo?.ward?.province_name
  const title = provinceName
    ? m.candidate_nearby_title_in({ place: shortPlaceName(provinceName) })
    : m.candidate_nearby_title()
  const placeLabel = origin?.label
    || (origin?.source === 'map' ? m.candidate_nearby_map_point() : m.candidate_nearby_my_location())
  // Mô tả nơi đang tra: phường/xã + tỉnh gần nhất (máy chủ suy từ tâm), không có thì tọa độ.
  const originWard = search.originInfo?.ward
  const nearLabel = originWard
    ? `${shortPlaceName(originWard.name)}, ${shortPlaceName(originWard.province_name)}`
    : origin && `${origin.latitude.toFixed(4)}, ${origin.longitude.toFixed(4)}`
  // Chữ trong ô vị trí: tên phường/địa chỉ đã chọn; GPS hoặc bấm bản đồ thì kèm phường gần nhất.
  const originText = origin?.label || (origin && (originWard ? `${placeLabel} · ${nearLabel}` : placeLabel))

  function updateParams(entries, options) {
    setSelectedPoint(null)
    setSearchParams((current) => mergeSearchParams(current, entries, options))
  }

  function chooseOrigin(next) {
    setPlaceError(false)
    setOrigin(next)
    updateParams({ gan: next.wardSlug || null })
  }

  async function locateMe() {
    const point = await position.locate()
    if (point) chooseOrigin({ ...point, label: null, source: 'gps' })
  }

  async function pickPlace(option) {
    if (option.type === 'ward') {
      chooseOrigin({ latitude: option.latitude, longitude: option.longitude, label: option.label, source: 'ward', wardSlug: option.slug })
      return
    }
    try {
      const point = await resolveGeoPlace(option.ref)
      chooseOrigin({ latitude: point.latitude, longitude: point.longitude, label: option.label, source: 'place' })
    } catch {
      setPlaceError(true)
    }
  }

  function moveOrigin(point) {
    if (isInVietnam(point.latitude, point.longitude)) chooseOrigin({ ...point, label: null, source: 'map' })
  }

  function selectPoint(point) {
    setSelectedPoint(point)
    setView('list')
    const first = document.querySelector(`[data-job-slug="${CSS.escape(point.jobs[0].slug)}"]`)
    first?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const geoError = placeError ? 'place' : position.error
  const accuracyKm = origin?.source === 'gps' && origin.accuracyKm > 1 ? Math.round(origin.accuracyKm) : null

  return (
    <div className="nearby-page">
      <nav className="nearby-page__breadcrumb" aria-label="breadcrumb">
        <Link to="/">{m.candidate_nearby_breadcrumb_home()}</Link>
        <span aria-hidden>›</span>
        <Link to="/viec-lam">{m.candidate_nearby_breadcrumb_jobs()}</Link>
        <span aria-hidden>›</span>
        <span>{m.candidate_nearby_title()}</span>
      </nav>
      <h1 className="nearby-page__title">{title}</h1>

      {!enabled ? (
        <div className="nearby-empty"><p>{m.candidate_nearby_disabled()}</p></div>
      ) : (
        <>
          <NearbyFilterBar
            filters={filters}
            radiusChoices={radiusOptions(maxRadius)}
            categories={categoryGroups}
            originLabel={originText}
            focus={origin}
            locating={position.locating}
            geoError={geoError}
            onUseLocation={locateMe}
            onPickPlace={pickPlace}
            onRadiusChange={(radius) => updateParams({ r: radius })}
            onApply={(draft) => updateParams({
              cat: draft.category || null,
              salary: draft.salary || null,
              remote: draft.remote ? '1' : null,
            })}
          />
          {accuracyKm && <p className="nearby-page__hint">{m.candidate_nearby_geo_inaccurate({ km: accuracyKm })}</p>}

          {hasMap && (
            <Segmented
              block
              className="nearby-page__views"
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: origin && search.count ? m.candidate_nearby_view_list_count({ count: search.count }) : m.candidate_nearby_view_list() },
                { value: 'map', label: m.candidate_nearby_view_map() },
              ]}
            />
          )}
          <div className="nearby-page__layout" data-view={view}>
            <NearbyMapPanel
              origin={origin}
              radius={filters.radius}
              points={search.points}
              truncated={search.truncated}
              activeSlugs={highlightedSlugs}
              onOriginChange={moveOrigin}
              onPointClick={selectPoint}
            />
            <div className="nearby-page__list">
              {selectedPoint && (
                <p className="nearby-page__selected">
                  {m.candidate_nearby_point_selected({ count: selectedPoint.jobs.length, place: shortPlaceName(selectedPoint.label) })}
                  <button type="button" onClick={() => setSelectedPoint(null)}>{m.candidate_nearby_point_clear()}</button>
                </p>
              )}
              {origin ? (
                <NearbyResults
                  jobs={search.jobs}
                  count={search.count}
                  radius={filters.radius}
                  placeLabel={placeLabel}
                  nearLabel={origin?.label === originWard?.name ? null : nearLabel}
                  provinceName={provinceName}
                  page={filters.page}
                  loading={search.loading}
                  error={search.error}
                  expandSuggestion={search.expandSuggestion}
                  highlightedSlugs={highlightedSlugs}
                  onHover={setHoveredSlug}
                  onPageChange={(page) => updateParams({ page: page > 1 ? page : null }, { resetPage: false })}
                  onExpand={(radius) => updateParams({ r: radius })}
                />
              ) : (
                <NearbyPickPrompt />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
