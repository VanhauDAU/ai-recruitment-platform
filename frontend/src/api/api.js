// Re-export tương thích: hạ tầng HTTP đã chuyển sang shared/api/client.
// Giữ file này để import cũ (`from './api'`, `@/api/api`) không vỡ trong thời
// gian chuyển tiếp; sẽ xóa ở PR cleanup (Giai đoạn 10). Xem ADR 0002.
export { default } from '@/shared/api/client'
