import { useSiteSetting } from './use-site-settings'

// Bản đồ nền (ADR-0029): chỉ nhận style của nhà cung cấp bản đồ Việt Nam, thể hiện
// đúng chủ quyền Hoàng Sa, Trường Sa và Biển Đông. Style dựng từ dữ liệu
// OpenStreetMap (OpenFreeMap, MapTiler…) gán tên Trung Quốc cho hai quần đảo nên bị
// loại, kể cả ở môi trường dev; thiếu style hợp lệ thì các màn hình ẩn bản đồ.
// Thêm nhà cung cấp mới: thêm host vào đây sau khi đã soát vùng Biển Đông.
export const VN_BASEMAP_HOSTS = ['maps.vietmap.vn']

export function isVietnameseBasemap(url) {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && VN_BASEMAP_HOSTS.includes(hostname)
  } catch {
    return false
  }
}

// `{ styleUrl, attribution }` khi site setting `map_style_url` hợp lệ, ngược lại null.
export function useBasemap() {
  const styleUrl = useSiteSetting('map_style_url')
  const attribution = useSiteSetting('map_attribution')
  return isVietnameseBasemap(styleUrl) ? { styleUrl, attribution } : null
}
