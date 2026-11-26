import { useMemo } from 'react'
import { useSiteSetting } from './use-site-settings'

// Bản đồ nền (ADR-0029): chỉ dùng bản đồ VietMap, thể hiện đúng chủ quyền Hoàng Sa,
// Trường Sa và Biển Đông. Style dựng từ dữ liệu OpenStreetMap (OpenFreeMap, MapTiler…)
// gán tên Trung Quốc cho hai quần đảo nên bị loại, kể cả ở dev; thiếu cấu hình hợp lệ
// thì các màn hình ẩn bản đồ.
//
// Site setting `map_style_url` là link style.json VietMap admin dán từ console
// (`https://maps.vietmap.vn/maps/styles/<kiểu>/style.json?apikey=…`). Tile vector trong
// style đó mã hoá theo định dạng riêng, chỉ SDK vietmap-gl đọc được: MapLibre chỉ vẽ
// được màu nền. Vì vậy dùng tile ảnh PNG cùng kiểu bản đồ, cùng key.
const VIETMAP_HOST = 'maps.vietmap.vn'
const VIETMAP_STYLE_PATH = /^\/maps\/styles\/([a-z]+)\/style\.json$/
const VIETMAP_MAX_ZOOM = 18 // từ 19 VietMap chỉ trả ảnh trống

export function vietmapRasterStyle(url, pixelRatio = 1) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const kind = parsed.pathname.match(VIETMAP_STYLE_PATH)?.[1]
  const key = parsed.searchParams.get('apikey')
  if (parsed.protocol !== 'https:' || parsed.hostname !== VIETMAP_HOST || !kind || !key) return null
  const scale = pixelRatio > 1 ? '@2x' : ''
  return {
    version: 8,
    sources: {
      vietmap: {
        type: 'raster',
        tiles: [`https://${VIETMAP_HOST}/maps/tiles/${kind}/{z}/{x}/{y}${scale}.png?apikey=${encodeURIComponent(key)}`],
        tileSize: 256,
        maxzoom: VIETMAP_MAX_ZOOM,
      },
    },
    layers: [{ id: 'vietmap', type: 'raster', source: 'vietmap' }],
  }
}

// `{ id, style, attribution }` khi `map_style_url` là style VietMap hợp lệ, ngược lại null.
// `id` (link gốc) làm key cho MapView: đổi cấu hình thì bản đồ dựng lại.
export function useBasemap() {
  const url = useSiteSetting('map_style_url')
  const attribution = useSiteSetting('map_attribution')
  return useMemo(() => {
    const style = vietmapRasterStyle(url, typeof window === 'undefined' ? 1 : window.devicePixelRatio)
    return style && { id: url, style, attribution }
  }, [url, attribution])
}
