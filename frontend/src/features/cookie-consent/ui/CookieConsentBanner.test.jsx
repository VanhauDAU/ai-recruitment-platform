import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import CookieConsentBanner from './CookieConsentBanner'

describe('CookieConsentBanner', () => {
  it('offers equal-priority reject, customize and accept actions', () => {
    const onAcceptAll = vi.fn()
    const onCustomize = vi.fn()
    const onRejectOptional = vi.fn()

    render(
      <MemoryRouter>
        <CookieConsentBanner
          onAcceptAll={onAcceptAll}
          onCustomize={onCustomize}
          onRejectOptional={onRejectOptional}
          saving={false}
        />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Chỉ cookie thiết yếu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tùy chỉnh cookie' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chấp nhận tất cả' }))

    expect(onRejectOptional).toHaveBeenCalledOnce()
    expect(onCustomize).toHaveBeenCalledOnce()
    expect(onAcceptAll).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Tìm hiểu thêm' })).toHaveAttribute('href', '/chinh-sach-cookie')
  })
})
