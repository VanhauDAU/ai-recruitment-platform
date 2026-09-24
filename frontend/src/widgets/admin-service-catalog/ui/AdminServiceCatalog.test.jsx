import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminServiceCatalog from './AdminServiceCatalog'

const {
  getAdminServiceCategories,
  getAdminServicePackages,
  getAdminPackageVersions,
  getAdminServiceCapabilities,
  serviceMutation,
} = vi.hoisted(() => ({
  getAdminServiceCategories: vi.fn(),
  getAdminServicePackages: vi.fn(),
  getAdminPackageVersions: vi.fn(),
  getAdminServiceCapabilities: vi.fn(),
  serviceMutation: vi.fn(),
}))

vi.mock('@/entities/service-package', () => ({
  createAdminPackageVersion: serviceMutation,
  createAdminServiceCategory: serviceMutation,
  createAdminServicePackage: serviceMutation,
  deleteAdminPackageVersion: serviceMutation,
  deleteAdminServiceCategory: serviceMutation,
  deleteAdminServicePackage: serviceMutation,
  getAdminPackageVersions,
  getAdminServiceCategories,
  getAdminServiceAudit: vi.fn(),
  getAdminServiceCapabilities,
  getAdminServiceEntitlements: vi.fn(),
  getAdminServicePackages,
  grantAdminServiceEntitlements: serviceMutation,
  publishAdminPackageVersion: serviceMutation,
  revokeAdminServiceEntitlement: serviceMutation,
  updateAdminPackageVersion: serviceMutation,
  updateAdminServiceCategory: serviceMutation,
  updateAdminServicePackage: serviceMutation,
}))

vi.mock('@/entities/admin-company', () => ({ getAdminCompanies: vi.fn() }))
vi.mock('@/entities/session', () => ({ useSession: () => ({ user: { id: 1 } }) }))
vi.mock('@/entities/admin-access', () => ({
  useAdminAccess: () => ({ has: () => true, isSuperuser: false }),
}))

vi.mock('@/shared/lib/toast', () => ({
  message: { error: vi.fn(), success: vi.fn() },
}))

describe('AdminServiceCatalog', () => {
  beforeEach(() => {
    getAdminServiceCategories.mockResolvedValue([{
      id: 1,
      key: 'tin-noi-bat',
      name_vi: 'Tin tuyển dụng nổi bật',
      name_en: 'Featured jobs',
      description_vi: 'Tăng tiếp cận ứng viên',
      packages_count: 1,
      order: 1,
      is_active: true,
    }])
    getAdminServicePackages.mockResolvedValue([])
    getAdminPackageVersions.mockResolvedValue([])
    getAdminServiceCapabilities.mockResolvedValue([])
    serviceMutation.mockReset()
  })

  it('renders the catalogue before an editor exists', async () => {
    render(
      <MemoryRouter>
        <AdminServiceCatalog />
      </MemoryRouter>,
    )

    await waitFor(() => expect(document.body).toHaveTextContent('Tin tuyển dụng nổi bật'))
    expect(document.body).toHaveTextContent('Sửa')
    expect(screen.getByText('Dịch vụ đang chạy')).toBeInTheDocument()
    expect(document.querySelector('.ant-modal')).toBeNull()
  })

  it('keeps commercial versions in a separate concise workspace', async () => {
    render(
      <MemoryRouter>
        <AdminServiceCatalog />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Phiên bản vận hành')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Phiên bản vận hành'))

    await waitFor(() => expect(getAdminPackageVersions).toHaveBeenCalled())
    expect(screen.getByText('Phiên bản đã phát hành là bất biến')).toBeInTheDocument()
  })
})
