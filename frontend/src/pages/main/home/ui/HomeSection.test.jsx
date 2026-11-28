import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import HomeSection from './HomeSection'

let observers = []

beforeEach(() => {
  observers = []
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback, options) {
      this.callback = callback
      this.options = options
      observers.push(this)
    }
    observe(node) { this.node = node }
    disconnect() {}
  })
})

afterEach(() => vi.unstubAllGlobals())

function enter(rootMargin, entry = { isIntersecting: true }) {
  const observer = observers.find((item) => item.options.rootMargin === rootMargin)
  act(() => observer.callback([{ boundingClientRect: { bottom: 1 }, ...entry }]))
}

test('mounts the block only when scrolled near, then reveals it in view', () => {
  const { container } = render(<HomeSection reserve={400}><p>Thị trường</p></HomeSection>)
  const wrapper = container.firstChild

  expect(screen.queryByText('Thị trường')).toBeNull()
  expect(wrapper).toHaveStyle({ minHeight: '400px' })

  enter('600px 0px')
  expect(screen.getByText('Thị trường')).toBeInTheDocument()
  expect(wrapper).not.toHaveClass('is-revealed')

  enter('0px 0px -12% 0px')
  expect(wrapper).toHaveClass('is-revealed')
})

test('treats a block already scrolled past as reached', () => {
  const { container } = render(<HomeSection eager><p>Việc làm</p></HomeSection>)

  expect(screen.getByText('Việc làm')).toBeInTheDocument()
  enter('0px 0px -12% 0px', { isIntersecting: false, boundingClientRect: { bottom: -20 } })
  expect(container.firstChild).toHaveClass('is-revealed')
})
