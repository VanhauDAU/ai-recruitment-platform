import { lazy } from 'react'

// Tab "Nội dung" kéo theo form antd, bộ soạn thảo và danh mục; chỉ tải khi mở tab.
export const CompanyContentEditor = lazy(() => import('./CompanyContentEditor'))
