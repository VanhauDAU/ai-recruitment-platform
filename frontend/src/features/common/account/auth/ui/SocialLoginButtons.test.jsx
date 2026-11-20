import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SocialLoginButtons from './SocialLoginButtons'

const siteSettings = vi.hoisted(() => ({ settings: {} }))
vi.mock('@/entities/system/site-settings', () => ({ useSiteSettings: () => siteSettings }))

describe('SocialLoginButtons appearance', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark')
    siteSettings.settings = {}
  })

  it('keeps the employer Google button light with readable hover text under a stale dark theme', () => {
    document.documentElement.classList.add('dark')

    render(<SocialLoginButtons portal="employer" appearance="employer" />)

    const button = screen.getByRole('button', { name: 'Đăng nhập bằng Google' })
    expect(button).toHaveClass(
      'bg-white',
      'text-slate-700',
      'hover:bg-blue-50/40',
      'hover:text-slate-900',
    )
    expect(button.className).not.toContain('dark:')
  })

  it('retains dark mode support for the default candidate appearance', () => {
    render(<SocialLoginButtons providers={['google']} />)

    expect(screen.getByRole('button', { name: 'Đăng nhập bằng Google' })).toHaveClass(
      'dark:bg-zinc-800',
      'dark:text-gray-200',
      'dark:border-zinc-700',
    )
  })

  it('shows only the providers the admin keeps open for the portal', () => {
    siteSettings.settings = { oauth_providers_candidate: ['linkedin', 'twitter'] }

    render(<SocialLoginButtons />)

    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /LinkedIn/ })).toBeInTheDocument()
  })

  it('renders nothing when the admin closes every provider of the portal', () => {
    siteSettings.settings = { oauth_providers_employer: [] }

    const { container } = render(<SocialLoginButtons portal="employer" />)

    expect(container).toBeEmptyDOMElement()
  })
})
