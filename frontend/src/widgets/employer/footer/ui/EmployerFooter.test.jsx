import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import EmployerFooter from './EmployerFooter'

const site = vi.hoisted(() => ({ settings: {} }))

vi.mock('@/entities/system/site-settings', async (importOriginal) => ({
  ...await importOriginal(),
  BrandLogo: () => null,
  useSiteSettings: () => ({ settings: site.settings, siteName: 'ProCV' }),
}))

const renderFooter = () => render(<MemoryRouter><EmployerFooter /></MemoryRouter>)

describe('EmployerFooter', () => {
  it('honors the footer switches shared with the candidate footer', () => {
    site.settings = {
      footer_facebook_url: 'https://facebook.com/procv',
      support_email: 'hotro@procv.vn',
      footer_show_socials: false,
      footer_show_contact: false,
      footer_copyright: '© {year} {site_name}',
    }

    renderFooter()

    expect(screen.queryByLabelText('Facebook')).not.toBeInTheDocument()
    expect(screen.queryByText('hotro@procv.vn')).not.toBeInTheDocument()
    expect(screen.getByText(`© ${new Date().getFullYear()} ProCV`)).toBeInTheDocument()
  })

  it('shows socials and contact by default', () => {
    site.settings = { footer_facebook_url: 'https://facebook.com/procv', support_email: 'hotro@procv.vn' }

    renderFooter()

    expect(screen.getByLabelText('Facebook')).toBeInTheDocument()
    expect(screen.getByText('hotro@procv.vn')).toBeInTheDocument()
  })
})
