import { useEffect, useRef, useState } from 'react'
import { AttributionControl, Map as MapLibreMap, Marker, NavigationControl, prewarm, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Worker của MapLibre là file .mjs riêng; Vite đóng gói nó thành asset worker để
// đường dẫn không phụ thuộc vị trí chunk sau khi build.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { circleBounds, circlePolygon, VIETNAM_CENTER } from '@/shared/lib/geo'
import './map.css'

// File này chỉ được import qua React.lazy (MapLibre ~200 KB gzip): không vào bundle
// khởi tạo. Style bản đồ lấy từ site setting `map_style_url` (VietMap/Goong); để
// trống thì dùng style OpenFreeMap (dữ liệu OpenStreetMap, không cần key, tự ghi công) — chỉ cho
// môi trường dev: bản đồ production phải theo chuẩn bản đồ Việt Nam (ADR-0029).
const DEV_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const RADIUS_SOURCE = 'radius'

setWorkerUrl(workerUrl)
// Giữ pool worker sống cả phiên: gỡ bản đồ rồi tạo lại ngay (StrictMode, đổi style,
// quay lại trang) không còn làm style mới chờ worker đã bị huỷ.
prewarm()

function pinElement({ kind, label, count, active, title }) {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = `map-pin map-pin--${kind}${active ? ' map-pin--active' : ''}`
  if (title) element.setAttribute('aria-label', title)
  const head = document.createElement('span')
  head.className = 'map-pin__head'
  if (count > 1) head.textContent = String(count)
  element.append(head)
  if (label) {
    const text = document.createElement('span')
    text.className = 'map-pin__label'
    text.textContent = label
    element.append(text)
  }
  return element
}

function radiusData(origin, radiusKm) {
  const features = origin && radiusKm
    ? [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circlePolygon(origin, radiusKm)] } }]
    : []
  return { type: 'FeatureCollection', features }
}

export default function MapView({
  styleUrl,
  attribution,
  origin,
  radiusKm,
  points = [],
  originLabel,
  onOriginChange,
  onPointClick,
  initialZoom = 5,
  fitPoints = false,
  className = '',
}) {
  const containerRef = useRef(null)
  const [map, setMap] = useState(null)
  const handlersRef = useRef({ onOriginChange, onPointClick })
  handlersRef.current = { onOriginChange, onPointClick }

  useEffect(() => {
    let instance = null
    // Tạo ở tick sau: lần mount thử của StrictMode bị huỷ trước khi có bản đồ, tránh
    // tạo–gỡ–tạo liền nhau làm style của bản đồ thứ hai không bao giờ tải xong.
    // (Không dùng requestAnimationFrame: tab ẩn sẽ không bao giờ tạo bản đồ.)
    const timer = setTimeout(() => {
      const center = origin || VIETNAM_CENTER
      instance = new MapLibreMap({
        container: containerRef.current,
        style: styleUrl || DEV_STYLE,
        center: [center.longitude, center.latitude],
        zoom: origin ? 12 : initialZoom,
        attributionControl: false,
      })
      instance.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
      instance.addControl(
        new AttributionControl({ compact: true, customAttribution: (styleUrl && attribution) || undefined }),
        'bottom-right',
      )
      instance.on('load', () => {
        instance.addSource(RADIUS_SOURCE, { type: 'geojson', data: radiusData(null) })
        instance.addLayer({ id: 'radius-fill', type: 'fill', source: RADIUS_SOURCE, paint: { 'fill-color': '#1d4f91', 'fill-opacity': 0.05 } })
        instance.addLayer({
          id: 'radius-line',
          type: 'line',
          source: RADIUS_SOURCE,
          paint: { 'line-color': '#1d4f91', 'line-width': 1.5, 'line-dasharray': [2, 2] },
        })
        // Ghi công thu gọn thành nút (i) ngay từ đầu để không che bản đồ trên mobile.
        instance.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
        setMap(instance)
      })
      instance.on('click', (event) => {
        handlersRef.current.onOriginChange?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng })
      })
    })
    return () => {
      clearTimeout(timer)
      instance?.remove()
      setMap(null)
    }
    // Bản đồ tạo một lần; style/attribution đổi thì trang tự remount bằng `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Gốc tìm kiếm + vòng bán kính: kéo ghim gốc để đổi vị trí.
  useEffect(() => {
    if (!map) return undefined
    map.getSource(RADIUS_SOURCE)?.setData(radiusData(origin, radiusKm))
    if (!origin) return undefined
    const marker = new Marker({
      element: pinElement({ kind: 'origin', title: originLabel }),
      anchor: 'bottom',
      draggable: Boolean(handlersRef.current.onOriginChange),
    })
      .setLngLat([origin.longitude, origin.latitude])
      .addTo(map)
    marker.getElement().addEventListener('click', (event) => event.stopPropagation())
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLngLat()
      handlersRef.current.onOriginChange?.({ latitude: lat, longitude: lng })
    })
    if (radiusKm) map.fitBounds(circleBounds(origin, radiusKm), { padding: 24, duration: 400 })
    else if (!fitPoints) map.easeTo({ center: [origin.longitude, origin.latitude], zoom: 15, duration: 400 })
    return () => marker.remove()
  }, [map, origin, radiusKm, originLabel, fitPoints])

  useEffect(() => {
    if (!map) return undefined
    const markers = points.map((point) => {
      const element = pinElement({ kind: 'job', ...point })
      element.addEventListener('click', (event) => {
        event.stopPropagation()
        handlersRef.current.onPointClick?.(point)
      })
      return new Marker({ element, anchor: 'bottom' })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map)
    })
    return () => markers.forEach((marker) => marker.remove())
  }, [map, points])

  // Bản đồ tổng quan (không có bán kính): khung vừa mọi ghim, kể cả gốc nếu có.
  useEffect(() => {
    if (!map || !fitPoints || !points.length) return
    const coordinates = [...points, ...(origin ? [origin] : [])].map((p) => [p.longitude, p.latitude])
    const bounds = coordinates.reduce(
      ([[w, s], [e, n]], [lng, lat]) => [[Math.min(w, lng), Math.min(s, lat)], [Math.max(e, lng), Math.max(n, lat)]],
      [coordinates[0], coordinates[0]],
    )
    map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 })
  }, [map, fitPoints, points, origin])

  return <div ref={containerRef} className={`map-view ${className}`} />
}
