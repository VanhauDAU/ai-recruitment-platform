import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AuthMascot from './AuthMascot'

describe('AuthMascot', () => {
  it('bám khung và phản ứng theo trường người dùng đang thao tác', () => {
    const { container, rerender } = render(<AuthMascot />)
    const mascot = () => container.querySelector('.procv-mascot')

    expect(mascot()).toHaveAttribute('data-pose', 'frameGrip')
    expect(container.querySelector('.auth-mascot-stage__grip')).toHaveAttribute(
      'src',
      expect.stringContaining('robot-hands-frame-grip.webp'),
    )

    rerender(<AuthMascot activeField="email" />)
    expect(mascot()).toHaveAttribute('data-gaze', 'down')

    rerender(<AuthMascot activeField="password" />)
    expect(mascot()).toHaveAttribute('data-pose', 'coverEyes')
    expect(container.querySelectorAll('.procv-mascot__face-arm')).toHaveLength(2)
    expect(container.querySelector('.auth-mascot-stage__grip')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('không nhìn')

    rerender(<AuthMascot activeField="password" passwordVisible />)
    expect(mascot()).toHaveAttribute('data-pose', 'peek')
    expect(container.querySelectorAll('.procv-mascot__face-arm')).toHaveLength(1)
  })

  it('chỉ giơ tay khi form đã thỏa mãn điều kiện', () => {
    const { container, rerender } = render(<AuthMascot success />)
    expect(container.querySelector('.auth-mascot-stage')).toHaveAttribute('data-state', 'success')
    expect(container.querySelector('.procv-mascot')).toHaveAttribute('data-pose', 'thumbsUp')

    rerender(<AuthMascot success activeField="password" />)
    expect(container.querySelector('.procv-mascot')).toHaveAttribute('data-pose', 'coverEyes')
  })

  it('hiển thị trạng thái riêng khi submit validation thất bại', () => {
    const { container } = render(<AuthMascot invalid />)
    expect(container.querySelector('.auth-mascot-stage')).toHaveAttribute('data-state', 'invalid')
    expect(container.querySelector('.procv-mascot')).toHaveAttribute('data-emotion', 'error')
    expect(screen.getByRole('status')).toHaveTextContent('chưa hợp lệ')
  })
})
