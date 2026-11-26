/* oxlint-disable react/only-export-components -- Lazy route registry exports component values. */
import { lazy } from 'react'

// Route `*`: path cũ (tiếng Anh) chuyển sang path hiện hành, còn lại là trang 404. Bảng
// path cũ và trang 404 nằm chung chunk này để không vào bundle khởi tạo.
export const LegacyPathFallbackPage = lazy(() => import('../redirects/LegacyPathFallback'))
