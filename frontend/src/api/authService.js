// Re-export tương thích: authService đã chuyển sang features/auth/api. Giữ file
// này để import cũ (`@/api/authService`, `../api/authService`) không vỡ; xóa ở
// PR cleanup (Giai đoạn 10). Xem ADR 0001.
export * from '@/features/auth/api/authService'
