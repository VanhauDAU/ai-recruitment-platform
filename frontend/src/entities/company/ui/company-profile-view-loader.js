import { lazy } from 'react'

// Router khởi tạo dùng hằng path từ barrel của entity này, nên mọi thứ barrel
// export tĩnh đều rơi vào bundle đầu. Bộ hiển thị trang công ty (hero, các khối,
// gallery antd, sanitize HTML, stylesheet) vì thế đứng sau một dynamic import.
export const preloadCompanyProfileView = () => import('./CompanyProfileView')

export const CompanyProfileView = lazy(preloadCompanyProfileView)
