import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AdminCvNav } from './AdminCvShell'

const access = vi.hoisted(() => ({ codes: new Set() }))
vi.mock('@/entities/session', () => ({ useSession: () => ({ user: {} }) }))
vi.mock('@/entities/admin-access', () => ({ useAdminAccess: () => ({ has: (code) => access.codes.has(code) }) }))

function renderNav(path, codes) {
  access.codes = new Set(codes)
  return render(<MemoryRouter initialEntries={[path]}><AdminCvNav /></MemoryRouter>)
}

describe('AdminCvNav', () => {
  it('links every CV admin page and marks the current one, including detail pages', () => {
    renderNav('/admin/app/cv/templates/tpl_1', ['cv_user.view'])

    const nav = screen.getByRole('navigation', { name: 'Các trang Mẫu CV' })
    expect(nav).toHaveTextContent('Tổng quanMẫu CVNội dung theo vị tríThư việnCV ứng viên')
    expect(screen.getByRole('link', { name: /Mẫu CV/ })).toHaveAttribute('aria-current', 'page')
  })

  it('hides the candidate CV page without its permission', () => {
    renderNav('/admin/app/cv/overview', [])

    expect(screen.queryByRole('link', { name: /CV ứng viên/ })).not.toBeInTheDocument()
  })
})
