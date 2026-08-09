import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminServiceCatalog from './AdminServiceCatalog'

const {
  getAdminServiceCategories,
  getAdminServicePackages,
  serviceMutation,
} = vi.hoisted(() => ({
  getAdminServiceCategories: vi.fn(),
  getAdminServicePackages: vi.fn(),
  serviceMutation: vi.fn(),
}))

vi.mock('@/entities/service-package', () => ({
  createAdminServiceCategory: serviceMutation,
  createAdminServicePackage: serviceMutation,
  deleteAdminServiceCategory: serviceMutation,
  deleteAdminServicePackage: serviceMutation,
  getAdminServiceCategories,
  getAdminServicePackages,
  updateAdminServiceCategory: serviceMutation,
  updateAdminServicePackage: serviceMutation,
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
    expect(document.querySelector('.ant-modal')).toBeNull()
  })
})
