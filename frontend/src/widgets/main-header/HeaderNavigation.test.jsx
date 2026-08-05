import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DesktopNavigation } from './HeaderNavigation'

const MENUS = [{
  key: 'jobs',
  label: 'Việc làm',
  to: '/viec-lam',
  columns: [[{
    title: 'Việc làm',
    items: [{ label: 'Tìm việc làm', to: '/viec-lam' }],
  }]],
}]

describe('DesktopNavigation', () => {
  it('mở submenu thay vì điều hướng khi chạm menu cấp cao có URL', () => {
    const onOpen = vi.fn()
    const onSelect = vi.fn()

    render(
      <DesktopNavigation
        menus={MENUS}
        openKey={null}
        pathname="/"
        onOpen={onOpen}
        onSelect={onSelect}
      />,
    )

    const trigger = screen.getByRole('button', { name: /Việc làm/ })
    fireEvent.click(trigger)

    expect(onOpen).toHaveBeenLastCalledWith('jobs')
    expect(onSelect).not.toHaveBeenCalled()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  })
})
