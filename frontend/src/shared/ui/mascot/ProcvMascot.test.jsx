import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ProcvMascot from './ProcvMascot'

describe('ProcvMascot', () => {
  it('xếp đúng các layer của pose và emotion', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { container } = render(
      <ProcvMascot emotion="thinking" pose="wave" size={80} blink talking shadow="floating" />,
    )

    const mascot = container.querySelector('.procv-mascot')
    const sources = [...mascot.querySelectorAll('img')].map((image) => image.getAttribute('src'))
    expect(mascot).toHaveAttribute('data-emotion', 'thinking')
    expect(mascot).toHaveAttribute('data-pose', 'wave')
    expect(mascot).toHaveStyle({ height: '80px', width: '80px' })
    expect(sources[1]).toContain('robot-body-core.webp')
    expect(sources[2]).toContain('robot-arm-right-neutral.webp')
    expect(sources[3]).toContain('robot-arm-left-wave.webp')
    expect(sources[4]).toContain('robot-head.webp')
    expect(sources).toEqual(expect.arrayContaining([
      expect.stringContaining('robot-eyes-thinking.webp'),
      expect.stringContaining('robot-eyes-blink.webp'),
      expect.stringContaining('robot-mouth-thinking.webp'),
    ]))
    expect(container.querySelector('.procv-mascot__eyes-base').style.animationDelay).toBe('-2.25s')
    expect(container.querySelector('.procv-mascot__eyes-blink').style.animationDelay).toBe('-2.25s')
  })

  it('ẩn miệng theo emotion khi đang nói để hai khẩu hình không chồng nhau', () => {
    const { container, rerender } = render(<ProcvMascot emotion="success" talking />)
    expect(container.querySelector('.procv-mascot__mouth-base')).toBeInTheDocument()
    expect(container.querySelector('.procv-mascot__mouth-talk')).toBeInTheDocument()

    rerender(<ProcvMascot emotion="success" />)
    expect(container.querySelector('.procv-mascot__mouth-base')).not.toBeInTheDocument()
    expect(container.querySelector('.procv-mascot__mouth-talk')).not.toBeInTheDocument()
  })

  it('fallback về state an toàn khi nhận prop không hợp lệ', () => {
    const { container } = render(<ProcvMascot emotion="unknown" pose="unknown" shadow="unknown" />)
    expect(container.querySelector('.procv-mascot')).toHaveAttribute('data-emotion', 'neutral')
    expect(container.querySelectorAll('img')).toHaveLength(6)
  })

  it('ghép đủ hai tay ôm, bảng checklist và hai bàn tay trước', () => {
    const { container } = render(<ProcvMascot pose="checklist" />)
    const sources = [...container.querySelectorAll('img')].map((image) => image.src)

    expect(container.querySelector('.procv-mascot')).toHaveAttribute('data-pose', 'checklist')
    expect(container.querySelectorAll('.procv-mascot__hand-front')).toHaveLength(2)
    expect(sources).toEqual(expect.arrayContaining([
      expect.stringContaining('robot-arm-left-hold.webp'),
      expect.stringContaining('robot-arm-right-hold.webp'),
      expect.stringContaining('robot-prop-checklist.webp'),
      expect.stringContaining('robot-hand-left-hold-front.webp'),
      expect.stringContaining('robot-hand-right-hold-front.webp'),
    ]))
  })

  it('ghép đúng grip, micro và bàn tay trước cho pose đọc bài', () => {
    const { container } = render(<ProcvMascot pose="microphone" />)
    const sources = [...container.querySelectorAll('img')].map((image) => image.src)

    expect(container.querySelector('.procv-mascot')).toHaveAttribute('data-pose', 'microphone')
    expect(sources).toEqual(expect.arrayContaining([
      expect.stringContaining('robot-arm-left-grip.webp'),
      expect.stringContaining('robot-prop-microphone.webp'),
      expect.stringContaining('robot-hand-left-grip-front.webp'),
    ]))
  })
})
