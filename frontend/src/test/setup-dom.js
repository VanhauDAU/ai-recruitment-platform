// Phần setup chỉ dành cho file chạy jsdom (mặc định). File test thuần logic
// khai báo `// @vitest-environment node` thì không nạp phần này.
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

Object.defineProperty(window, 'localStorage', { configurable: true, value: globalThis.localStorage })

// jsdom không có matchMedia/ResizeObserver — antd (Grid, Dropdown, Form) cần chúng.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false },
  })
}
if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom intentionally does not implement pseudo-element styles. Ant Design's
// wave/motion helpers still ask for them after every click, which prints a
// warning and makes interaction-heavy suites spend most of their time inside
// jsdom's virtual console. Ignoring the unsupported second argument preserves
// jsdom's real computed-style behavior while removing that test-only overhead.
const getComputedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = (element) => {
  const styles = getComputedStyle(element)
  const getPropertyValue = styles.getPropertyValue.bind(styles)
  styles.getPropertyValue = (property) => {
    const value = getPropertyValue(property)
    if (
      /^(padding-(top|bottom)|border-(top|bottom)-width)$/.test(property)
      && !Number.isFinite(Number.parseFloat(value))
    ) {
      return '0px'
    }
    return value
  }
  return styles
}

// jsdom also logs on every canvas context request before returning null.
// Returning that same unsupported value directly keeps canvas fallbacks
// testable without flooding CI output.
HTMLCanvasElement.prototype.getContext = () => null

afterEach(() => {
  cleanup()
})
