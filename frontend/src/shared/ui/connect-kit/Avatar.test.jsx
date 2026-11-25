import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Avatar from './Avatar'
import { avatarInitial } from './avatar-initial'

describe('Avatar', () => {
  it('uses the first letter of the last word, as Vietnamese names put the given name last', () => {
    expect(avatarInitial('Nguyễn Văn An')).toBe('A')
    expect(avatarInitial('  công ty abc ')).toBe('A')
    expect(avatarInitial('')).toBe('?')
  })

  it('shows the picture when there is one', () => {
    const { container } = render(<Avatar src="/logo.png" name="ProCV" />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/logo.png')
  })
})
