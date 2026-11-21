// Backend trả 503 `code=maintenance` khi admin bật chế độ bảo trì (ADR-0026).
// Client báo qua kênh này để app hiện màn bảo trì ngay cả khi bản cấu hình đã
// tải trước đó còn ghi "đang chạy".
const subscribers = new Set()

export function notifyMaintenance(message) {
  subscribers.forEach((subscriber) => subscriber(message))
}

export function subscribeToMaintenance(subscriber) {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}
