import {
  AppstoreOutlined, BankOutlined, BookOutlined, DiffOutlined, EditOutlined, EnvironmentOutlined, FileDoneOutlined,
  GlobalOutlined, HeartOutlined, LikeOutlined, ProfileOutlined, SearchOutlined, UploadOutlined,
} from '@ant-design/icons'
import { COMPANY_DIRECTORY_PATH } from '@/entities/company/company'
import { ACCOUNT_ROOT } from '@/entities/account/account'
import { blogCategoryPath } from '@/entities/content/blog'
import { m } from '@/shared/config/i18n'

// Nhóm có `source` lấy mục từ dữ liệu thật (danh mục nghề, lĩnh vực, danh mục
// mẫu CV) — xem `navigationForCapabilities`. `requiresAuth` mở popup đăng nhập
// tại chỗ cho khách thay vì để trang đích đá về /login.
export const HEADER_NAVIGATION = [
  {
    key: 'jobs',
    label: 'Việc làm',
    to: '/viec-lam',
    activePaths: ['/jobs', '/viec-lam-gan-ban', '/so-sanh-viec-lam', COMPANY_DIRECTORY_PATH],
    columns: [
      [
        {
          title: 'Việc làm',
          items: [
            { label: 'Tìm việc làm', to: '/viec-lam', icon: <SearchOutlined /> },
            { label: m.candidate_nearby_nav(), to: '/viec-lam-gan-ban', icon: <EnvironmentOutlined />, requiresNearbyJobs: true },
            { label: 'Việc làm đã lưu', to: '/viec-lam-da-luu', icon: <BookOutlined />, requiresAuth: true },
            { label: 'Việc làm đã ứng tuyển', to: `${ACCOUNT_ROOT}/viec-lam-da-ung-tuyen`, icon: <FileDoneOutlined />, requiresAuth: true },
            { label: 'Việc làm phù hợp', to: `${ACCOUNT_ROOT}/viec-lam-phu-hop`, icon: <LikeOutlined />, requiresAuth: true },
            { label: 'So sánh việc làm', to: '/so-sanh-viec-lam', icon: <DiffOutlined /> },
          ],
        },
        {
          title: 'Công ty',
          items: [
            { label: 'Danh sách công ty', to: COMPANY_DIRECTORY_PATH, icon: <BankOutlined /> },
            { label: 'Công ty đang theo dõi', to: `${ACCOUNT_ROOT}/cong-ty-dang-theo-doi`, icon: <HeartOutlined />, requiresAuth: true },
          ],
        },
      ],
      [{ title: 'Việc làm theo nhóm nghề', cols: 2, source: 'jobGroups' }],
      [{ title: 'Việc làm theo lĩnh vực', source: 'industries' }],
    ],
  },
  {
    key: 'cv',
    label: 'Tạo CV',
    to: '/mau-cv',
    activePaths: ['/cv-templates', '/mau-cv-tieng-anh', '/tai-cv-len'],
    columns: [
      [
        {
          title: 'Mẫu CV',
          items: [
            { label: 'Khám phá tất cả mẫu CV', to: '/mau-cv', icon: <AppstoreOutlined /> },
            { label: 'Mẫu CV tiếng Anh', to: '/mau-cv-tieng-anh', icon: <GlobalOutlined /> },
          ],
        },
        { title: 'Mẫu CV theo phong cách', cols: 2, source: 'cvStyles' },
      ],
      [{ title: 'Mẫu CV theo vị trí ứng tuyển', source: 'cvPositions' }],
      [{
        title: 'Quản lý CV',
        items: [
          { label: 'CV của tôi', to: `${ACCOUNT_ROOT}/cv-cua-toi`, icon: <ProfileOutlined />, requiresAuth: true },
          { label: 'Tải CV lên', to: '/tai-cv-len', icon: <UploadOutlined />, requiresAuth: true },
          {
            label: 'Hướng dẫn viết CV',
            to: '/tro-giup/cv-va-mau-cv',
            icon: <EditOutlined />,
            requiresKnowledgebase: true,
          },
        ],
      }],
    ],
  },
  {
    key: 'handbook',
    label: 'Cẩm nang nghề nghiệp',
    to: '/blog',
    // Desktop dùng dropdown riêng (HandbookDropdown); cột này cho menu mobile.
    columns: [[
      { source: 'blogCategories' },
      { items: [{ label: 'Tất cả bài viết', to: '/blog', icon: <BookOutlined /> }] },
    ]],
  },
]

const cvCategoryItems = (type, prefix = '') => (categories) => categories
  .filter((category) => category.category_type === type)
  .map((category) => ({ label: `${prefix}${category.name}`, to: `/mau-cv/${category.slug}` }))

// Chuyển dữ liệu API thô thành mục menu cho từng `source`.
export const NAVIGATION_SOURCES = {
  jobGroups: (categories) => categories
    .filter((category) => category.parent == null)
    .map((category) => ({ label: category.name, to: `/viec-lam?cat=${category.id}` })),
  industries: (industries) => industries
    .map((industry) => ({ label: industry.name, to: `/viec-lam?nganh=${industry.id}` })),
  blogCategories: (categories) => categories
    .map((category) => ({ label: category.name, to: blogCategoryPath(category.slug) })),
  cvStyles: cvCategoryItems('style'),
  cvPositions: cvCategoryItems('position', 'Mẫu CV '),
}

export function flattenMenuItems(menu) {
  return menu.columns.flatMap((column) => column.flatMap((group) => group.items))
}

/**
 * Lọc mục theo năng lực backend và đổ dữ liệu cho nhóm động. `sources[key]`
 * chưa có (undefined) = đang tải → nhóm hiện skeleton; mảng rỗng → ẩn nhóm.
 */
export function navigationForCapabilities(
  menus,
  { knowledgebaseEnabled = false, nearbyJobsEnabled = true, sources = {} } = {},
) {
  return menus.map((menu) => ({
    ...menu,
    columns: menu.columns
      .map((column) => column
        .map((group) => {
          if (!group.source) {
            return {
              ...group,
              items: group.items.filter((item) => (knowledgebaseEnabled || !item.requiresKnowledgebase)
                && (nearbyJobsEnabled || !item.requiresNearbyJobs)),
            }
          }
          const raw = sources[group.source]
          return raw === undefined
            ? { ...group, items: [], loading: true }
            : { ...group, items: NAVIGATION_SOURCES[group.source](raw) }
        })
        .filter((group) => group.loading || group.items.length > 0))
      .filter((column) => column.length > 0),
  }))
}

export function isMenuActive(menu, pathname) {
  if (!menu.to) return false
  return [menu.to, ...(menu.activePaths || [])].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}
