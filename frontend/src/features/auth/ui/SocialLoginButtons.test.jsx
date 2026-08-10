import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import SocialLoginButtons from './SocialLoginButtons'

describe('SocialLoginButtons appearance', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark')
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
})
