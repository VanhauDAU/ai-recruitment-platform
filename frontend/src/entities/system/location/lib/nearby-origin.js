// Gốc tìm "Việc làm gần tôi" của phiên hiện tại: chỉ sessionStorage (không lưu
// lên máy chủ, không đưa tọa độ GPS lên URL). Trang chi tiết tin đọc lại để hiện
// "Cách bạn x km".
const STORAGE_KEY = 'procv.nearby_origin'

export function readNearbyOrigin() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
    return Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude) ? value : null
  } catch {
    return null
  }
}

export function saveNearbyOrigin(origin) {
  try {
    if (origin) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(origin))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Chế độ riêng tư chặn storage: gốc vẫn sống trong state của trang.
  }
}
