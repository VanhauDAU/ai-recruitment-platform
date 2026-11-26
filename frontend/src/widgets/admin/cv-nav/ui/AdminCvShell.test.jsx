import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AdminCvNav } from './AdminCvShell'

describe('AdminCvNav', () => {
  it('links every CV admin page and marks the current one, including detail pages', () => {
    render(<MemoryRouter initialEntries={['/admin/app/cv/mau-cv/tpl_1']}><AdminCvNav /></MemoryRouter>)

    const nav = screen.getByRole('navigation', { name: 'Các trang Mẫu CV' })
    expect(nav).toHaveTextContent('Tổng quanMẫu CVNội dung theo vị tríThư việnCV ứng viên')
    expect(screen.getByRole('link', { name: /Mẫu CV/ })).toHaveAttribute('aria-current', 'page')
  })
})
